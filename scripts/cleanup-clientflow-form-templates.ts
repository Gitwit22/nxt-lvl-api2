import { Prisma, PrismaClient } from '../src/generated/clientflow';
import {
  ensureCoreIntakeFields,
  normalizeProgramFormFields,
  normalizePublicFormFields,
} from '../src/modules/clientflow/form-field-mapping';
import {
  FieldDefinitionConflictError,
  inventoryTemplateFields,
  mergeTemplateFields,
  renderedSectionsReferenceTemplate,
} from '../src/modules/clientflow/form-template-cleanup';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const inventory = process.argv.includes('--inventory');
const recovery = process.argv.includes('--recovery');
const organizationId = argumentValue('--organization-id');
const requestedMapping = argumentValue('--mapping');
const restoreTemplateId = argumentValue('--restore-template');
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

function effectiveScope(scope: string, programId: string | null): string {
  return scope === 'legacy' && programId !== null ? 'program_section' : scope;
}

function normalizedFields(template: {
  id: string;
  programId: string | null;
  scope: string;
  fields: Prisma.JsonValue;
}) {
  const scope = effectiveScope(template.scope, template.programId);
  if (scope === 'master_core') return ensureCoreIntakeFields(template.fields);
  if (scope === 'program_section') {
    return normalizeProgramFormFields(template.fields, template.programId, template.id);
  }
  return normalizePublicFormFields(template.fields);
}

function rawFieldIds(fields: Prisma.JsonValue): string[] {
  if (!Array.isArray(fields)) return [];
  return fields.flatMap((field) => {
    if (field === null || typeof field !== 'object' || Array.isArray(field)) return [];
    const id = (field as Record<string, Prisma.JsonValue>).id;
    return typeof id === 'string' && id.trim() ? [id.trim()] : [];
  });
}

async function auditAllTemplates(): Promise<void> {
  const [templates, programs] = await Promise.all([
    prisma.cfFormTemplate.findMany({
      where: { organizationId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    }),
    prisma.cfProgram.findMany({
      where: { organizationId },
      select: { id: true, name: true, isActive: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  const programById = new Map(programs.map((program) => [program.id, program]));
  const activeSections = templates.filter((template) =>
    template.isActive && effectiveScope(template.scope, template.programId) === 'program_section');
  const selectedByProgram = new Map(programs.map((program) => {
    const candidates = activeSections.filter((template) => template.programId === program.id);
    const selected = candidates.find((template) => template.scope === 'program_section') ?? candidates[0];
    return [program.id, selected?.id ?? null];
  }));

  const results = templates.map((template) => {
    const rawIds = rawFieldIds(template.fields);
    const duplicateIds = [...new Set(rawIds.filter((id, index) => rawIds.indexOf(id) !== index))];
    const rawElementCount = Array.isArray(template.fields) ? template.fields.length : 0;
    const unusableElementCount = rawElementCount - rawIds.length;
    const normalized = normalizedFields(template);
    const normalizedIds = normalized.map(({ id }) => id);
    const selectedTemplateId = template.programId
      ? selectedByProgram.get(template.programId) ?? null
      : null;
    const warnings = [
      ...(!Array.isArray(template.fields) ? ['fields-not-array'] : []),
      ...(unusableElementCount > 0
        ? [`${unusableElementCount}-unusable-field-elements`]
        : []),
      ...(duplicateIds.length > 0 ? ['duplicate-field-ids'] : []),
      ...(template.isActive && template.programId && selectedTemplateId !== template.id
        ? [`shadowed-by:${selectedTemplateId}`]
        : []),
      ...(template.isActive && template.programId && !programById.get(template.programId)?.isActive
        ? ['program-inactive-or-missing']
        : []),
      ...(template.isActive && rawIds.length === 0 && normalizedIds.length === 0
        ? ['active-template-has-no-questions']
        : []),
    ];
    return {
      id: template.id,
      name: template.name,
      isActive: template.isActive,
      scope: template.scope,
      effectiveScope: effectiveScope(template.scope, template.programId),
      programId: template.programId,
      programName: template.programId ? programById.get(template.programId)?.name ?? null : null,
      selectedForPublicProgram: selectedTemplateId === template.id,
      rawFieldIds: rawIds,
      normalizedFieldIds: normalizedIds,
      unusableElementCount,
      duplicateIds,
      warnings,
    };
  });

  console.log(JSON.stringify({
    mode: 'ALL_TEMPLATE_INVENTORY',
    organizationId,
    templateCount: results.length,
    warningCount: results.filter(({ warnings }) => warnings.length > 0).length,
    templates: results,
  }, null, 2));
}

function historicalSections(value: Prisma.JsonValue): Array<{
  templateId: string;
  templateVersion: number;
  fields: ReturnType<typeof normalizePublicFormFields>;
}> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((section) => {
    if (section === null || typeof section !== 'object' || Array.isArray(section)) return [];
    const candidate = section as Record<string, Prisma.JsonValue>;
    if (typeof candidate.templateId !== 'string') return [];
    const fields = normalizePublicFormFields(candidate.fields);
    if (fields.length === 0) return [];
    return [{
      templateId: candidate.templateId,
      templateVersion: typeof candidate.templateVersion === 'number'
        ? candidate.templateVersion
        : 0,
      fields,
    }];
  });
}

async function auditHistoricalRecovery(): Promise<void> {
  const [templates, renderSessions, snapshots] = await Promise.all([
    prisma.cfFormTemplate.findMany({ where: { organizationId }, orderBy: { id: 'asc' } }),
    prisma.cfIntakeRenderSession.findMany({
      where: { organizationId },
      select: { createdAt: true, renderedSections: true },
    }),
    prisma.cfIntakeSubmissionSnapshot.findMany({
      where: { organizationId },
      select: { createdAt: true, renderedSections: true },
    }),
  ]);
  const damagedTemplates = templates.filter((template) => {
    const rawIds = rawFieldIds(template.fields);
    const rawElementCount = Array.isArray(template.fields) ? template.fields.length : 0;
    return !Array.isArray(template.fields)
      || rawElementCount > rawIds.length
      || (template.isActive && normalizedFields(template).length === 0);
  });
  const records = [
    ...renderSessions.map((record) => ({ ...record, source: 'render_session' as const })),
    ...snapshots.map((record) => ({ ...record, source: 'submission_snapshot' as const })),
  ];

  const results = damagedTemplates.map((template) => {
    const candidates = new Map<string, {
      templateVersion: number;
      fields: ReturnType<typeof normalizePublicFormFields>;
      occurrences: number;
      latestSeenAt: string;
      sources: Set<string>;
    }>();
    for (const record of records) {
      for (const section of historicalSections(record.renderedSections)) {
        if (section.templateId !== template.id) continue;
        const key = JSON.stringify(section.fields);
        const createdAt = record.createdAt.toISOString();
        const existing = candidates.get(key);
        if (existing) {
          existing.occurrences += 1;
          if (createdAt > existing.latestSeenAt) existing.latestSeenAt = createdAt;
          existing.sources.add(record.source);
        } else {
          candidates.set(key, {
            templateVersion: section.templateVersion,
            fields: section.fields,
            occurrences: 1,
            latestSeenAt: createdAt,
            sources: new Set([record.source]),
          });
        }
      }
    }
    return {
      id: template.id,
      name: template.name,
      currentRawFieldIds: rawFieldIds(template.fields),
      candidates: [...candidates.values()]
        .sort((left, right) => right.latestSeenAt.localeCompare(left.latestSeenAt))
        .map((candidate) => ({
          ...candidate,
          sources: [...candidate.sources].sort(),
          fieldIds: candidate.fields.map(({ id }) => id),
        })),
    };
  });

  console.log(JSON.stringify({
    mode: 'HISTORICAL_QUESTION_RECOVERY',
    organizationId,
    templates: results,
  }, null, 2));
}

async function historicalCandidatesForTemplate(client: DbClient, templateId: string) {
  const [renderSessions, snapshots] = await Promise.all([
    client.cfIntakeRenderSession.findMany({
      where: { organizationId },
      select: { createdAt: true, renderedSections: true },
    }),
    client.cfIntakeSubmissionSnapshot.findMany({
      where: { organizationId },
      select: { createdAt: true, renderedSections: true },
    }),
  ]);
  const candidates = new Map<string, {
    fields: ReturnType<typeof normalizePublicFormFields>;
    occurrences: number;
    latestSeenAt: string;
  }>();
  for (const record of [...renderSessions, ...snapshots]) {
    for (const section of historicalSections(record.renderedSections)) {
      if (section.templateId !== templateId) continue;
      const key = JSON.stringify(section.fields);
      const createdAt = record.createdAt.toISOString();
      const existing = candidates.get(key);
      if (existing) {
        existing.occurrences += 1;
        if (createdAt > existing.latestSeenAt) existing.latestSeenAt = createdAt;
      } else {
        candidates.set(key, { fields: section.fields, occurrences: 1, latestSeenAt: createdAt });
      }
    }
  }
  return [...candidates.values()].sort((left, right) =>
    right.latestSeenAt.localeCompare(left.latestSeenAt));
}

async function inspectHistoricalRestore(client: DbClient, templateId: string) {
  const template = await client.cfFormTemplate.findFirst({
    where: { id: templateId, organizationId },
  });
  if (!template) throw new Error(`Template ${templateId} was not found in this organization.`);
  const currentIds = rawFieldIds(template.fields);
  if (currentIds.length > 0) {
    throw new Error(
      `Template ${templateId} already has valid stored fields (${currentIds.join(', ')}); refusing to overwrite editor data.`,
    );
  }
  const candidates = await historicalCandidatesForTemplate(client, templateId);
  if (candidates.length !== 1) {
    throw new Error(
      `Template ${templateId} has ${candidates.length} distinct historical field sets; exactly one is required.`,
    );
  }
  const candidate = candidates[0];
  const fields = normalizedFields({ ...template, fields: candidate.fields as unknown as Prisma.JsonValue });
  if (fields.length === 0) throw new Error(`Template ${templateId} has no recoverable fields.`);
  return { template, candidate, fields };
}

async function restoreHistoricalFields(templateId: string) {
  return prisma.$transaction(async (tx) => {
    const inspection = await inspectHistoricalRestore(tx, templateId);
    const updated = await tx.cfFormTemplate.update({
      where: { id: inspection.template.id },
      data: {
        fields: inspection.fields as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
      select: { id: true, version: true, fields: true },
    });
    return {
      id: updated.id,
      version: updated.version,
      fieldIds: rawFieldIds(updated.fields),
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5_000,
    timeout: 30_000,
  });
}

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
  if ((inventory || recovery) && apply) {
    throw new Error('--inventory and --recovery are read-only and cannot be combined with --apply.');
  }
  if (inventory && recovery) throw new Error('Use either --inventory or --recovery, not both.');
  if (restoreTemplateId && (inventory || recovery || requestedMapping)) {
    throw new Error('--restore-template cannot be combined with inventory, recovery, or mapping modes.');
  }
  if (apply && !requestedMapping && !restoreTemplateId) {
    throw new Error('--apply requires one explicit --mapping or --restore-template.');
  }
  if (apply && requestedMapping && confirmation !== 'CONSOLIDATE_CLIENTFLOW_FORMS') {
    throw new Error('--apply requires --confirm CONSOLIDATE_CLIENTFLOW_FORMS.');
  }
  if (apply && restoreTemplateId && confirmation !== 'RESTORE_CLIENTFLOW_TEMPLATE_FIELDS') {
    throw new Error('--apply restore requires --confirm RESTORE_CLIENTFLOW_TEMPLATE_FIELDS.');
  }

  if (inventory) {
    await auditAllTemplates();
    return;
  }
  if (recovery) {
    await auditHistoricalRecovery();
    return;
  }
  if (restoreTemplateId) {
    const inspection = await inspectHistoricalRestore(prisma, restoreTemplateId);
    console.log(JSON.stringify({
      mode: apply ? 'APPLY_HISTORICAL_RESTORE' : 'DRY_RUN_HISTORICAL_RESTORE',
      id: inspection.template.id,
      name: inspection.template.name,
      occurrences: inspection.candidate.occurrences,
      latestSeenAt: inspection.candidate.latestSeenAt,
      fieldIds: inspection.fields.map(({ id }) => id),
      result: apply ? await restoreHistoricalFields(restoreTemplateId) : 'no changes',
    }, null, 2));
    return;
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
