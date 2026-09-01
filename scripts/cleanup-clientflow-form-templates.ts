import { Prisma, PrismaClient } from '../src/generated/clientflow';
import { normalizeProgramFormFields } from '../src/modules/clientflow/form-field-mapping';
import {
  FieldDefinitionConflictError,
  inventoryTemplateFields,
  mergeTemplateFields,
  renderedSectionsReferenceTemplate,
} from '../src/modules/clientflow/form-template-cleanup';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const organizationId = argumentValue('--organization-id');
const requestedMapping = argumentValue('--mapping');
const confirmation = argumentValue('--confirm');

const mappings = {
  inspired: {
    programId: 'prog-inspired-detroit',
    retiringId: 'form-inspired-detroit',
    survivorId: 'form-inspired-detroit-approved',
  },
  growth: {
    programId: 'prog-growth-partnership',
    retiringId: 'form-growth-partnership-approved',
    survivorId: 'form-growth-partnership',
    conflictResolutions: { revenue: 'survivor' } as const,
  },
} as const;

type MappingName = keyof typeof mappings;
type DbClient = Prisma.TransactionClient | PrismaClient;

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function selectedMappings(): Array<[MappingName, typeof mappings[MappingName]]> {
  if (!requestedMapping) return Object.entries(mappings) as Array<[MappingName, typeof mappings[MappingName]]>;
  if (!(requestedMapping in mappings)) {
    throw new Error(`Unknown mapping ${requestedMapping}. Use inspired or growth.`);
  }
  const name = requestedMapping as MappingName;
  return [[name, mappings[name]]];
}

async function referenceCounts(client: DbClient, templateId: string) {
  const [programs, assignments, renderSessions, snapshots, allSessions, allSnapshots] = await Promise.all([
    client.cfProgram.count({ where: { organizationId, defaultFormTemplateId: templateId } }),
    client.cfFormAssignment.findMany({
      where: { organizationId, formId: templateId },
      select: { status: true, sentAt: true, openedAt: true, startedAt: true, submittedAt: true },
    }),
    client.cfIntakeRenderSession.count({ where: { organizationId, coreTemplateId: templateId } }),
    client.cfIntakeSubmissionSnapshot.count({ where: { organizationId, coreTemplateId: templateId } }),
    client.cfIntakeRenderSession.findMany({ where: { organizationId }, select: { renderedSections: true } }),
    client.cfIntakeSubmissionSnapshot.findMany({ where: { organizationId }, select: { renderedSections: true } }),
  ]);
  const safeDraftAssignments = assignments.filter((assignment) =>
    assignment.status === 'draft'
    && assignment.sentAt === null
    && assignment.openedAt === null
    && assignment.startedAt === null
    && assignment.submittedAt === null).length;
  return {
    programs,
    assignments: {
      total: assignments.length,
      safeDrafts: safeDraftAssignments,
      historical: assignments.length - safeDraftAssignments,
      byStatus: Object.fromEntries(
        [...new Set(assignments.map(({ status }) => status))]
          .sort()
          .map((status) => [status, assignments.filter((assignment) => assignment.status === status).length]),
      ),
    },
    renderSessions,
    snapshots,
    embeddedRenderSessions: allSessions.filter(({ renderedSections }) =>
      renderedSectionsReferenceTemplate(renderedSections, templateId)).length,
    embeddedSnapshots: allSnapshots.filter(({ renderedSections }) =>
      renderedSectionsReferenceTemplate(renderedSections, templateId)).length,
  };
}

function totalReferences(counts: Awaited<ReturnType<typeof referenceCounts>>): number {
  return counts.programs
    + counts.assignments.total
    + counts.renderSessions
    + counts.snapshots
    + counts.embeddedRenderSessions
    + counts.embeddedSnapshots;
}

async function inspectMapping(client: DbClient, name: MappingName) {
  const mapping = mappings[name];
  const [retiring, survivor] = await Promise.all([
    client.cfFormTemplate.findFirst({ where: { id: mapping.retiringId, organizationId } }),
    client.cfFormTemplate.findFirst({ where: { id: mapping.survivorId, organizationId } }),
  ]);
  if (!retiring || !survivor) {
    throw new Error(`${name}: missing ${!retiring ? mapping.retiringId : mapping.survivorId}.`);
  }
  if (retiring.programId !== mapping.programId || survivor.programId !== mapping.programId) {
    throw new Error(`${name}: templates do not both belong to ${mapping.programId}.`);
  }

  const retiringInventory = inventoryTemplateFields(retiring.fields);
  const survivorInventory = inventoryTemplateFields(survivor.fields);
  if (retiringInventory.duplicateIds.length || survivorInventory.duplicateIds.length) {
    throw new Error(`${name}: duplicate field IDs must be resolved before consolidation.`);
  }
  const merge = mergeTemplateFields(
    survivorInventory.validFields,
    retiringInventory.validFields,
    'conflictResolutions' in mapping ? mapping.conflictResolutions : undefined,
  );
  const fields = normalizeProgramFormFields(merge.fields, mapping.programId, mapping.survivorId);
  const references = await referenceCounts(client, mapping.retiringId);

  return {
    mapping,
    retiring,
    survivor,
    retiringInventory,
    survivorInventory,
    merge,
    fields,
    references,
  };
}

function report(name: MappingName, inspection: Awaited<ReturnType<typeof inspectMapping>>) {
  const { mapping, retiring, survivor, retiringInventory, survivorInventory, merge, fields, references } = inspection;
  console.log(JSON.stringify({
    mapping: name,
    programId: mapping.programId,
    retiring: {
      id: retiring.id,
      scope: retiring.scope,
      isActive: retiring.isActive,
      rawShape: retiringInventory.shape,
      rawCount: retiringInventory.rawCount,
      validFieldIds: retiringInventory.validFields.map(({ id }) => id),
      invalidElementCount: retiringInventory.invalidElementCount,
    },
    survivor: {
      id: survivor.id,
      scope: survivor.scope,
      isActive: survivor.isActive,
      rawShape: survivorInventory.shape,
      rawCount: survivorInventory.rawCount,
      validFieldIds: survivorInventory.validFields.map(({ id }) => id),
      invalidElementCount: survivorInventory.invalidElementCount,
    },
    proposed: {
      appendedIds: merge.appendedIds,
      identicalIds: merge.identicalIds,
      resolvedConflicts: merge.resolvedConflicts,
      fieldIds: fields.map(({ id }) => id),
      references,
      retirement: totalReferences(references) === 0 ? 'delete' : 'deactivate-and-retain',
    },
  }, null, 2));
}

async function applyMapping(name: MappingName) {
  return prisma.$transaction(async (tx) => {
    const inspection = await inspectMapping(tx, name);
    const { mapping, survivor, fields } = inspection;
    if (survivor.scope !== 'program_section') {
      throw new Error(`${name}: survivor ${survivor.id} must have program_section scope.`);
    }

    await tx.cfFormTemplate.update({
      where: { id: survivor.id },
      data: {
        fields: fields as unknown as Prisma.InputJsonValue,
        isActive: true,
        version: { increment: 1 },
      },
    });
    const programs = await tx.cfProgram.updateMany({
      where: { organizationId, defaultFormTemplateId: mapping.retiringId },
      data: { defaultFormTemplateId: mapping.survivorId },
    });
    const draftAssignments = await tx.cfFormAssignment.updateMany({
      where: {
        organizationId,
        formId: mapping.retiringId,
        status: 'draft',
        sentAt: null,
        openedAt: null,
        startedAt: null,
        submittedAt: null,
      },
      data: { formId: mapping.survivorId },
    });
    await tx.cfFormTemplate.update({
      where: { id: mapping.retiringId },
      data: { isActive: false },
    });

    const references = await referenceCounts(tx, mapping.retiringId);
    let deleted = false;
    if (totalReferences(references) === 0) {
      await tx.cfFormTemplate.delete({ where: { id: mapping.retiringId } });
      deleted = true;
    }
    return { programs: programs.count, draftAssignments: draftAssignments.count, references, deleted };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5_000,
    timeout: 30_000,
  });
}

async function main() {
  if (!process.env.CLIENTFLOW_DATABASE_URL) {
    throw new Error('CLIENTFLOW_DATABASE_URL is required. Use the Neon ClientFlow connection string.');
  }
  if (!organizationId) throw new Error('--organization-id is required.');
  if (apply && !requestedMapping) throw new Error('--apply requires one explicit --mapping.');
  if (apply && confirmation !== 'CONSOLIDATE_CLIENTFLOW_FORMS') {
    throw new Error('--apply requires --confirm CONSOLIDATE_CLIENTFLOW_FORMS.');
  }

  console.log(`ClientFlow form cleanup mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
  for (const [name] of selectedMappings()) {
    try {
      const inspection = await inspectMapping(prisma, name);
      report(name, inspection);
      if (apply) console.log(JSON.stringify({ mapping: name, result: await applyMapping(name) }, null, 2));
    } catch (error) {
      if (!apply && error instanceof FieldDefinitionConflictError) {
        console.log(JSON.stringify({
          mapping: name,
          blocked: true,
          reason: error.message,
          conflict: {
            fieldId: error.fieldId,
            survivor: error.survivor,
            retiring: error.retiring,
          },
        }, null, 2));
        continue;
      }
      throw error;
    }
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
