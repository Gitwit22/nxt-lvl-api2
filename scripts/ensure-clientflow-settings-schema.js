const { PrismaClient } = require('@prisma/client');
const { PrismaClient: ClientflowPrismaClient } = require('../src/generated/clientflow');

const REQUIRED_CLIENTFLOW_SCHEMA = {
  AdminUser: ['jobTitle'],
  CfIntakeSubmission: [
    'configurationToken',
    'formAssignmentId',
    'idempotencyKey',
    'requestHash',
    'responsePayload',
    'resultPayload',
  ],
  CfIntakeRenderSession: ['configurationToken', 'renderedSections', 'expiresAt'],
  CfIntakeSubmissionSnapshot: ['intakeSubmissionId', 'renderedSections', 'selectedProgramIds'],
  CfIntakeSubmissionProgram: ['intakeSubmissionId', 'programId', 'enrollmentId', 'responsePayload'],
  CfProgramEnrollment: [
    'lastModifiedByUserId',
    'lastModifiedByDisplayName',
    'targetCompletionDate',
    'currentGoalId',
    'lastProgressUpdate',
    'clientResponsiveness',
    'currentBlockers',
    'riskLevel',
    'staffProgressNotes',
    'meetingsAttended',
    'outcomeAchieved',
    'finalOutcomeSummary',
  ],
  CfEnrollmentStatusHistory: ['changedByDisplayName'],
  CfActivityLog: ['actorUserId'],
  CfNotification: [
    'id',
    'organizationId',
    'recipientAdminId',
    'type',
    'title',
    'message',
    'actionUrl',
    'sourceType',
    'sourceId',
    'clientId',
    'submissionId',
    'readAt',
    'isDemo',
    'createdAt',
  ],
};

const REQUIRED_CLIENTFLOW_INDEXES = [
  'CfNotification_recipientAdminId_sourceType_sourceId_key',
  'CfNotification_organizationId_recipientAdminId_createdAt_idx',
  'CfNotification_organizationId_recipientAdminId_readAt_idx',
  'CfNotification_organizationId_isDemo_idx',
];

const REQUIRED_CLIENTFLOW_CONSTRAINTS = [
  'CfNotification_recipientAdminId_fkey',
];

function findMissingClientflowSchema(columns) {
  const available = new Set(columns.map(({ table_name, column_name }) => `${table_name}.${column_name}`));
  return Object.entries(REQUIRED_CLIENTFLOW_SCHEMA).flatMap(([tableName, columnNames]) =>
    columnNames
      .filter((columnName) => !available.has(`${tableName}.${columnName}`))
      .map((columnName) => `${tableName}.${columnName}`),
  );
}

function findMissingNames(required, rows, property) {
  const available = new Set(rows.map((row) => row[property]));
  return required.filter((name) => !available.has(name));
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  if (!process.env.CLIENTFLOW_DATABASE_URL) throw new Error('CLIENTFLOW_DATABASE_URL is required.');
  if (process.env.DATABASE_URL === process.env.CLIENTFLOW_DATABASE_URL) {
    throw new Error('DATABASE_URL and CLIENTFLOW_DATABASE_URL must target different databases.');
  }

  const primary = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  const clientflow = new ClientflowPrismaClient({
    datasourceUrl: process.env.CLIENTFLOW_DATABASE_URL,
  });

  try {
    await clientflow.$executeRawUnsafe(`
      ALTER TABLE "AdminUser"
      ADD COLUMN IF NOT EXISTS "jobTitle" TEXT
    `);
    await clientflow.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CfClientResponsiveness') THEN
          CREATE TYPE "CfClientResponsiveness" AS ENUM ('responsive', 'inconsistent', 'unresponsive', 'unknown');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CfEnrollmentRiskLevel') THEN
          CREATE TYPE "CfEnrollmentRiskLevel" AS ENUM ('low', 'medium', 'high', 'critical');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CfOutcomeAchieved') THEN
          CREATE TYPE "CfOutcomeAchieved" AS ENUM ('yes', 'partial', 'no', 'pending');
        END IF;
      END $$
    `);
    await clientflow.$executeRawUnsafe(`
      ALTER TABLE "CfProgramEnrollment"
      ADD COLUMN IF NOT EXISTS "lastModifiedByUserId" TEXT,
      ADD COLUMN IF NOT EXISTS "lastModifiedByDisplayName" TEXT,
      ADD COLUMN IF NOT EXISTS "targetCompletionDate" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "currentGoalId" TEXT,
      ADD COLUMN IF NOT EXISTS "lastProgressUpdate" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "clientResponsiveness" "CfClientResponsiveness" NOT NULL DEFAULT 'unknown',
      ADD COLUMN IF NOT EXISTS "currentBlockers" TEXT,
      ADD COLUMN IF NOT EXISTS "riskLevel" "CfEnrollmentRiskLevel" NOT NULL DEFAULT 'low',
      ADD COLUMN IF NOT EXISTS "staffProgressNotes" TEXT,
      ADD COLUMN IF NOT EXISTS "meetingsAttended" INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "outcomeAchieved" "CfOutcomeAchieved" NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS "finalOutcomeSummary" TEXT
    `);
    await clientflow.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CfProgramEnrollment_organizationId_lastModifiedByUserId_idx"
      ON "CfProgramEnrollment"("organizationId", "lastModifiedByUserId")
    `);
    await clientflow.$executeRawUnsafe(`
      ALTER TABLE "CfIntakeSubmissionProgram"
      ADD COLUMN IF NOT EXISTS "responsePayload" JSONB NOT NULL DEFAULT '{}'
    `);
    await clientflow.$executeRawUnsafe(`
      ALTER TABLE "CfEnrollmentStatusHistory"
      ADD COLUMN IF NOT EXISTS "changedByDisplayName" TEXT
    `);
    await clientflow.$executeRawUnsafe(`
      ALTER TABLE "CfActivityLog"
      ADD COLUMN IF NOT EXISTS "actorUserId" TEXT
    `);
    await clientflow.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CfActivityLog_organizationId_actorUserId_idx"
      ON "CfActivityLog"("organizationId", "actorUserId")
    `);
    await clientflow.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CfNotification" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "recipientAdminId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "actionUrl" TEXT,
        "sourceType" TEXT NOT NULL,
        "sourceId" TEXT NOT NULL,
        "clientId" TEXT,
        "submissionId" TEXT,
        "readAt" TIMESTAMP(3),
        "isDemo" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CfNotification_pkey" PRIMARY KEY ("id")
      )
    `);
    await clientflow.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "CfNotification_recipientAdminId_sourceType_sourceId_key"
      ON "CfNotification"("recipientAdminId", "sourceType", "sourceId")
    `);
    await clientflow.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CfNotification_organizationId_recipientAdminId_createdAt_idx"
      ON "CfNotification"("organizationId", "recipientAdminId", "createdAt")
    `);
    await clientflow.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CfNotification_organizationId_recipientAdminId_readAt_idx"
      ON "CfNotification"("organizationId", "recipientAdminId", "readAt")
    `);
    await clientflow.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CfNotification_organizationId_isDemo_idx"
      ON "CfNotification"("organizationId", "isDemo")
    `);
    await clientflow.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'CfNotification_recipientAdminId_fkey'
            AND conrelid = '"CfNotification"'::regclass
        ) THEN
          ALTER TABLE "CfNotification"
          ADD CONSTRAINT "CfNotification_recipientAdminId_fkey"
          FOREIGN KEY ("recipientAdminId") REFERENCES "AdminUser"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);

    const clientflowColumns = await clientflow.$queryRawUnsafe(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name IN (
          'AdminUser',
          'CfIntakeSubmission',
          'CfIntakeRenderSession',
          'CfIntakeSubmissionSnapshot',
          'CfIntakeSubmissionProgram',
          'CfProgramEnrollment',
          'CfEnrollmentStatusHistory',
          'CfActivityLog',
          'CfNotification'
        )
    `);
    const clientflowIndexes = await clientflow.$queryRawUnsafe(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = 'CfNotification'
    `);
    const clientflowConstraints = await clientflow.$queryRawUnsafe(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = '"CfNotification"'::regclass
    `);

    const missingClientflowSchema = findMissingClientflowSchema(clientflowColumns);
    const missingClientflowIndexes = findMissingNames(
      REQUIRED_CLIENTFLOW_INDEXES,
      clientflowIndexes,
      'indexname',
    );
    const missingClientflowConstraints = findMissingNames(
      REQUIRED_CLIENTFLOW_CONSTRAINTS,
      clientflowConstraints,
      'conname',
    );
    if (
      missingClientflowSchema.length > 0
      || missingClientflowIndexes.length > 0
      || missingClientflowConstraints.length > 0
    ) {
      throw new Error([
        ...missingClientflowSchema,
        ...missingClientflowIndexes,
        ...missingClientflowConstraints,
      ].join(', '));
    }

    console.log('ClientFlow submission schema repaired and verified.');

    await primary.$executeRawUnsafe(`
      ALTER TABLE "Organization"
      ADD COLUMN IF NOT EXISTS "liveMode" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "demoRemovedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "principalAdminId" TEXT
    `);
    await primary.$executeRawUnsafe(`
      ALTER TABLE "AdminUser"
      ADD COLUMN IF NOT EXISTS "jobTitle" TEXT
    `);

    const primaryColumns = await primary.$queryRawUnsafe(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND (table_name, column_name) IN (
          ('Organization', 'liveMode'),
          ('Organization', 'demoRemovedAt'),
          ('Organization', 'principalAdminId'),
          ('AdminUser', 'jobTitle')
        )
    `);
    if (primaryColumns.length !== 4) {
      throw new Error('Primary settings schema could not be verified.');
    }

    console.log('ClientFlow settings, member, and notification schema verified.');
  } finally {
    await Promise.allSettled([primary.$disconnect(), clientflow.$disconnect()]);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('ClientFlow settings schema repair failed.', error);
    process.exitCode = 1;
  });
}

module.exports = {
  findMissingClientflowSchema,
  findMissingNames,
  main,
  REQUIRED_CLIENTFLOW_SCHEMA,
  REQUIRED_CLIENTFLOW_INDEXES,
  REQUIRED_CLIENTFLOW_CONSTRAINTS,
};