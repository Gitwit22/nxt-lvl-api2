const { PrismaClient } = require('../src/generated/clientflow');

async function main() {
  const prisma = new PrismaClient({
    datasourceUrl: process.env.CLIENTFLOW_DATABASE_URL,
  });

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "AuthSession"
      ADD COLUMN IF NOT EXISTS "refreshTokenHash" TEXT,
      ADD COLUMN IF NOT EXISTS "refreshExpiresAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "refreshRotatedAt" TIMESTAMP(3)
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "AuthSession_refreshTokenHash_key"
      ON "AuthSession"("refreshTokenHash")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AuthSession_refreshExpiresAt_idx"
      ON "AuthSession"("refreshExpiresAt")
    `);

    const columns = await prisma.$queryRawUnsafe(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'AuthSession'
        AND column_name IN ('refreshTokenHash', 'refreshExpiresAt', 'refreshRotatedAt')
    `);
    if (columns.length !== 3) {
      throw new Error('ClientFlow AuthSession refresh columns could not be verified.');
    }

    console.log('ClientFlow AuthSession refresh schema verified.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('ClientFlow AuthSession schema repair failed.', error);
  process.exitCode = 1;
});