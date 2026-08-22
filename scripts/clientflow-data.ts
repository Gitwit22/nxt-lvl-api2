import { PrismaClient as SourcePrismaClient } from '@prisma/client';
import {
  CfEnrollmentStatus,
  Prisma,
  PrismaClient as TargetPrismaClient,
} from '@prisma/clientflow-client';
import { createHash } from 'crypto';

type Row = Record<string, unknown> & { id: string };
type Delegate = {
  count(): Promise<number>;
  findMany(args?: unknown): Promise<Row[]>;
  upsert(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
};

const source = new SourcePrismaClient();
const target = new TargetPrismaClient();

const modelNames = Prisma.dmmf.datamodel.models.map(({ name }) => name);

function delegateFor(modelName: string): Delegate {
  const delegateName = `${modelName[0].toLowerCase()}${modelName.slice(1)}`;
  return (target as unknown as Record<string, Delegate>)[delegateName];
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function sourceColumns(modelName: string): Promise<Set<string>> {
  const rows = await source.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = ${modelName}
  `;
  return new Set(rows.map(({ column_name }) => column_name));
}

async function sourceRows(modelName: string, columns: string[]): Promise<Row[]> {
  if (columns.length === 0) return [];
  const selection = columns.map(quoteIdentifier).join(', ');
  return source.$queryRawUnsafe<Row[]>(
    `SELECT ${selection} FROM ${quoteIdentifier(modelName)} ORDER BY "id"`,
  );
}

async function copyModel(modelName: string): Promise<number | null> {
  const model = Prisma.dmmf.datamodel.models.find(({ name }) => name === modelName);
  if (!model) throw new Error(`Unknown target model ${modelName}.`);

  const availableColumns = await sourceColumns(modelName);
  if (availableColumns.size === 0) return null;

  const columns = model.fields
    .filter(({ kind, name }) => kind === 'scalar' && availableColumns.has(name))
    .map(({ name }) => name);
  const rows = await sourceRows(modelName, columns);
  const delegate = delegateFor(modelName);

  for (const row of rows) {
    const { id, ...update } = row;
    await delegate.upsert({ where: { id }, create: row, update });
  }

  return rows.length;
}

function enrollmentId(clientId: string, programId: string): string {
  const digest = createHash('md5').update(`${clientId}:${programId}`).digest('hex');
  return `cfenr_${digest}`;
}

function enrollmentStatus(status: string): CfEnrollmentStatus {
  switch (status.trim().toLowerCase()) {
    case 'approved':
      return CfEnrollmentStatus.approved;
    case 'onboarding':
    case 'terms proposed':
    case 'contract pending':
      return CfEnrollmentStatus.onboarding;
    case 'active':
    case 'monitoring':
      return CfEnrollmentStatus.active;
    case 'completed':
    case 'final report needed':
    case 'pre-archive':
    case 'archived':
      return CfEnrollmentStatus.completed;
    case 'declined':
    case 'not a fit':
    case 'defaulted':
    case 'closed early':
      return CfEnrollmentStatus.declined;
    case 'on hold':
    case 'waitlisted':
      return CfEnrollmentStatus.on_hold;
    default:
      return CfEnrollmentStatus.interested;
  }
}

async function backfillLegacyEnrollments(): Promise<number> {
  const clients = await target.cfClient.findMany({ where: { programId: { not: null } } });
  let created = 0;

  for (const client of clients) {
    const programId = client.programId!;
    const id = enrollmentId(client.id, programId);
    const existing = await target.cfProgramEnrollment.findUnique({
      where: { clientId_programId: { clientId: client.id, programId } },
    });
    const enrollment = existing ?? await target.cfProgramEnrollment.create({
      data: {
        id,
        organizationId: client.organizationId,
        clientId: client.id,
        programId,
        status: enrollmentStatus(client.status),
        assignedUserId: client.assignedUserId,
        assignedStaff: client.assignedStaff,
        startDate: client.convertedAt ?? client.createdAt,
        nextActionDate: client.nextFollowUpDate,
        isDemo: client.isDemo,
        isArchived: client.isArchived,
        archivedAt: client.archivedAt,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      },
    });
    if (!existing) created += 1;

    await target.cfEnrollmentStatusHistory.upsert({
      where: { id: `cfeh_${createHash('md5').update(`${enrollment.id}:backfill`).digest('hex')}` },
      create: {
        id: `cfeh_${createHash('md5').update(`${enrollment.id}:backfill`).digest('hex')}`,
        organizationId: enrollment.organizationId,
        enrollmentId: enrollment.id,
        newStatus: enrollment.status,
        reason: 'Backfilled from legacy client program and status.',
        createdAt: enrollment.createdAt,
      },
      update: {},
    });
  }

  return created;
}

async function linkLegacyRecords(): Promise<void> {
  const enrollments = await target.cfProgramEnrollment.findMany();
  const byClientProgram = new Map(
    enrollments.map((item) => [`${item.organizationId}:${item.clientId}:${item.programId}`, item.id]),
  );
  const byClient = new Map<string, string[]>();
  for (const enrollment of enrollments) {
    const key = `${enrollment.organizationId}:${enrollment.clientId}`;
    byClient.set(key, [...(byClient.get(key) ?? []), enrollment.id]);
  }

  const programScoped = [
    target.cfTerms,
    target.cfMonitoringItem,
    target.cfContract,
    target.cfFinalReport,
  ] as unknown as Delegate[];
  for (const delegate of programScoped) {
    const records = await delegate.findMany({ where: { enrollmentId: null } });
    for (const record of records) {
      const id = byClientProgram.get(`${record.organizationId}:${record.clientId}:${record.programId}`);
      if (id) await delegate.update({ where: { id: record.id }, data: { enrollmentId: id } } as never);
    }
  }

  const templates = new Map(
    (await target.cfFormTemplate.findMany({ where: { programId: { not: null } } }))
      .map((template) => [template.id, template.programId!]),
  );
  const assignments = await target.cfFormAssignment.findMany({ where: { enrollmentId: null } });
  for (const assignment of assignments) {
    const programId = templates.get(assignment.formId);
    if (!programId) continue;
    const id = byClientProgram.get(`${assignment.organizationId}:${assignment.clientId}:${programId}`);
    if (id) {
      await target.cfFormAssignment.update({
        where: { id: assignment.id },
        data: { enrollmentId: id },
      });
    }
  }

  const profileScoped = [
    target.cfDocument,
    target.cfCommunication,
    target.cfActivityLog,
  ] as unknown as Delegate[];
  for (const delegate of profileScoped) {
    const records = await delegate.findMany({ where: { enrollmentId: null } });
    for (const record of records) {
      const ids = byClient.get(`${record.organizationId}:${record.clientId}`) ?? [];
      if (ids.length === 1) {
        await delegate.update({ where: { id: record.id }, data: { enrollmentId: ids[0] } } as never);
      }
    }
  }
}

async function copy(): Promise<void> {
  const copied: Record<string, number> = {};
  for (const modelName of modelNames) {
    const count = await copyModel(modelName);
    if (count !== null) copied[modelName] = count;
  }
  const backfilledEnrollments = await backfillLegacyEnrollments();
  await linkLegacyRecords();
  console.log(JSON.stringify({ copied, backfilledEnrollments }, null, 2));
}

async function verify(): Promise<void> {
  const failures: string[] = [];
  const counts: Record<string, { source: number; target: number }> = {};

  for (const modelName of modelNames) {
    const columns = await sourceColumns(modelName);
    if (!columns.has('id')) continue;
    const sourceIds = await sourceRows(modelName, ['id']);
    const targetIds = new Set((await delegateFor(modelName).findMany({ select: { id: true } })).map(({ id }) => id));
    const missingIds = sourceIds.filter(({ id }) => !targetIds.has(id));
    counts[modelName] = { source: sourceIds.length, target: targetIds.size };
    if (missingIds.length > 0) failures.push(`${modelName}: ${missingIds.length} source IDs missing in target`);
  }

  const unenrolledClients = await target.cfClient.count({ where: {
    programId: { not: null },
    NOT: { id: { in: (await target.cfProgramEnrollment.findMany({ select: { clientId: true } })).map(({ clientId }) => clientId) } },
  } });
  if (unenrolledClients > 0) failures.push(`${unenrolledClients} legacy clients have no program enrollment`);

  console.log(JSON.stringify({ counts, failures }, null, 2));
  if (failures.length > 0) process.exitCode = 1;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'copy') return copy();
  if (command === 'verify') return verify();
  throw new Error('Usage: ts-node scripts/clientflow-data.ts <copy|verify>');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([source.$disconnect(), target.$disconnect()]);
  });
