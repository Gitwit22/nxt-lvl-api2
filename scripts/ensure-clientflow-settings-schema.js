const { PrismaClient } = require('@prisma/client');
const { PrismaClient: ClientflowPrismaClient } = require('../src/generated/clientflow');

async function main() {
  const primary = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  const clientflow = new ClientflowPrismaClient({
    datasourceUrl: process.env.CLIENTFLOW_DATABASE_URL,
  });

  try {
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

    await clientflow.$executeRawUnsafe(`
      ALTER TABLE "AdminUser"
      ADD COLUMN IF NOT EXISTS "jobTitle" TEXT
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
    const clientflowColumns = await clientflow.$queryRawUnsafe(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND (
          (table_name = 'AdminUser' AND column_name = 'jobTitle')
          OR (table_name = 'CfNotification' AND column_name IN (
            'id', 'organizationId', 'recipientAdminId', 'type', 'title', 'message',
            'actionUrl', 'sourceType', 'sourceId', 'clientId', 'submissionId',
            'readAt', 'isDemo', 'createdAt'
          ))
        )
    `);

    if (primaryColumns.length !== 4 || clientflowColumns.length !== 15) {
      throw new Error('ClientFlow settings schema could not be verified.');
    }

    console.log('ClientFlow settings, member, and notification schema verified.');
  } finally {
    await Promise.allSettled([primary.$disconnect(), clientflow.$disconnect()]);
  }
}

main().catch((error) => {
  console.error('ClientFlow settings schema repair failed.', error);
  process.exitCode = 1;
});