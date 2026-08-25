import { Prisma, PrismaClient } from '../src/generated/clientflow';
import {
  ensureCoreIntakeFields,
  normalizeProgramFormFields,
} from '../src/modules/clientflow/form-field-mapping';

interface StoredField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  prefillKey?: string;
}

interface StoredSection {
  kind: 'core' | 'program';
  programId: string | null;
  fields: StoredField[];
}

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

function objectValue(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Prisma.JsonValue>
    : {};
}

function fieldsValue(value: Prisma.JsonValue): StoredField[] {
  return Array.isArray(value) ? value as unknown as StoredField[] : [];
}

function normalizeCore(fields: StoredField[]): StoredField[] {
  return ensureCoreIntakeFields(fields);
}

function normalizeProgram(
  fields: StoredField[],
  programId: string | null,
  templateId: string,
): StoredField[] {
  return normalizeProgramFormFields(fields, programId, templateId);
}

async function normalizeTemplates(): Promise<void> {
  const templates = await prisma.cfFormTemplate.findMany({ orderBy: [{ organizationId: 'asc' }, { id: 'asc' }] });
  let changed = 0;

  for (const template of templates) {
    const before = fieldsValue(template.fields);
    const dynamicProgramSection = template.scope === 'program_section'
      || (template.scope === 'legacy' && template.programId !== null);
    const after = template.scope === 'master_core'
      ? normalizeCore(before)
      : dynamicProgramSection
        ? normalizeProgram(before, template.programId, template.id)
        : before;
    if (JSON.stringify(before) === JSON.stringify(after)) continue;

    const duplicateIds = after.filter((field, index) =>
      after.findIndex((candidate) => candidate.id === field.id) !== index,
    );
    if (duplicateIds.length > 0) {
      throw new Error(`Template ${template.id} would retain duplicate field IDs.`);
    }

    changed += 1;
    console.log(`${apply ? 'Updating' : 'Would update'} ${template.name}: ${before.length} -> ${after.length} fields`);
    if (apply) {
      await prisma.cfFormTemplate.update({
        where: { id: template.id },
        data: { fields: after as unknown as Prisma.InputJsonValue, version: { increment: 1 } },
      });
    }
  }
  console.log(`${apply ? 'Updated' : 'Found'} ${changed} template(s).`);
}

async function backfillProgramResponses(): Promise<void> {
  const links = await prisma.cfIntakeSubmissionProgram.findMany({ orderBy: { id: 'asc' } });
  let changed = 0;

  for (const link of links) {
    if (Object.keys(objectValue(link.responsePayload)).length > 0) continue;
    const [submission, snapshot] = await Promise.all([
      prisma.cfIntakeSubmission.findUnique({ where: { id: link.intakeSubmissionId } }),
      prisma.cfIntakeSubmissionSnapshot.findUnique({ where: { intakeSubmissionId: link.intakeSubmissionId } }),
    ]);
    if (!submission || !snapshot || !Array.isArray(snapshot.renderedSections)) continue;

    const section = (snapshot.renderedSections as unknown as StoredSection[]).find(
      (candidate) => candidate.kind === 'program' && candidate.programId === link.programId,
    );
    if (!section) continue;
    const source = objectValue(submission.responsePayload);
    const responses = Object.fromEntries(
      section.fields
        .filter((field) => source[field.id] !== undefined)
        .map((field) => [field.id, source[field.id]]),
    );
    if (Object.keys(responses).length === 0) continue;

    changed += 1;
    console.log(`${apply ? 'Backfilling' : 'Would backfill'} program answers for link ${link.id}.`);
    if (apply) {
      await prisma.cfIntakeSubmissionProgram.update({
        where: { id: link.id },
        data: { responsePayload: responses as Prisma.InputJsonValue },
      });
    }
  }
  console.log(`${apply ? 'Backfilled' : 'Found'} ${changed} program response link(s).`);
}

async function main(): Promise<void> {
  if (!process.env.CLIENTFLOW_DATABASE_URL) {
    throw new Error(
      'CLIENTFLOW_DATABASE_URL is not set. Run npm run clientflow:forms:deploy '
      + 'or set $env:CLIENTFLOW_DATABASE_URL in this PowerShell session.',
    );
  }
  console.log(`ClientFlow form normalization mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
  await normalizeTemplates();
  await backfillProgramResponses();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());