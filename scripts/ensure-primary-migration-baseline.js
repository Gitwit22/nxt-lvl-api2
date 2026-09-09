const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

const BASELINE_MIGRATIONS = [
  '20260818225500_add_clientflow_live_mode',
  '20260831120000_add_refresh_sessions',
  '20260903120000_add_admin_job_title',
  '20260903130000_restore_platform_seed_login',
];

const REQUIRED_COLUMNS = [
  'Organization.liveMode',
  'Organization.demoRemovedAt',
  'Organization.principalAdminId',
  'AdminInvitation.revokedAt',
  'AuthSession.refreshTokenHash',
  'AuthSession.refreshExpiresAt',
  'AuthSession.refreshRotatedAt',
  'AdminUser.jobTitle',
];

const REQUIRED_INDEXES = [
  'Organization_principalAdminId_key',
  'AuthSession_jti_key',
  'AuthSession_adminUserId_revokedAt_idx',
  'AuthSession_expiresAt_idx',
  'AuthSession_refreshTokenHash_key',
  'AuthSession_refreshExpiresAt_idx',
];

const REQUIRED_CONSTRAINTS = [
  'Organization_principalAdminId_fkey',
  'AuthSession_adminUserId_fkey',
];

function findBaselineProblems(state) {
  return [
    ...REQUIRED_COLUMNS.filter((name) => !state.columns.includes(name)).map((name) => `column:${name}`),
    ...REQUIRED_INDEXES.filter((name) => !state.indexes.includes(name)).map((name) => `index:${name}`),
    ...REQUIRED_CONSTRAINTS
      .filter((name) => !state.constraints.includes(name))
      .map((name) => `constraint:${name}`),
    ...(state.legacyClientflowTableCount === 0 ? [] : ['legacy-clientflow-tables']),
    ...(state.platformIdentityReady ? [] : ['platform-identity']),
  ];
}

async function inspectBaseline(prisma) {
  const [history] = await prisma.$queryRawUnsafe(`
    SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS "exists"
  `);
  if (history.exists) return { historyExists: true };

  const columns = await prisma.$queryRawUnsafe(`
    SELECT table_name || '.' || column_name AS name
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `);
  const indexes = await prisma.$queryRawUnsafe(`
    SELECT indexname AS name FROM pg_indexes WHERE schemaname = 'public'
  `);
  const constraints = await prisma.$queryRawUnsafe(`
    SELECT conname AS name FROM pg_constraint WHERE connamespace = 'public'::regnamespace
  `);
  const [legacy] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::integer AS count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'Cf%'
  `);
  const [identity] = await prisma.$queryRawUnsafe(`
    SELECT
      organization.id IS NOT NULL
        AND organization.status = 'active'
        AND admin_user.id IS NOT NULL
        AND admin_user."organizationId" = organization.id
        AND admin_user.role = 'super_admin'
        AND admin_user."isActive" AS ready
    FROM (SELECT 1) AS singleton
    LEFT JOIN "Organization" AS organization ON organization.slug = 'nxt-lvl'
    LEFT JOIN "AdminUser" AS admin_user ON admin_user.email = 'nxtlvltechllc@gmail.com'
  `);

  return {
    historyExists: false,
    columns: columns.map(({ name }) => name),
    indexes: indexes.map(({ name }) => name),
    constraints: constraints.map(({ name }) => name),
    legacyClientflowTableCount: legacy.count,
    platformIdentityReady: identity.ready === true,
  };
}

function resolveMigration(migration, env) {
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(
    npxCommand,
    ['prisma', 'migrate', 'resolve', '--applied', migration, '--schema', 'prisma/schema.prisma'],
    { env, stdio: 'inherit' },
  );
  if (result.error || result.status !== 0) {
    throw new Error(`Could not baseline primary migration ${migration}.`);
  }
}

async function main(env = process.env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  let state;
  try {
    state = await inspectBaseline(prisma);
  } finally {
    await prisma.$disconnect();
  }

  if (state.historyExists) {
    console.log('Primary Prisma migration history already exists; baseline skipped.');
    return;
  }

  const problems = findBaselineProblems(state);
  if (problems.length > 0) {
    throw new Error(`Primary database cannot be baselined: ${problems.join(', ')}.`);
  }

  for (const migration of BASELINE_MIGRATIONS) resolveMigration(migration, env);
  console.log('Primary Prisma migration baseline recorded after schema verification.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  BASELINE_MIGRATIONS,
  REQUIRED_COLUMNS,
  REQUIRED_CONSTRAINTS,
  REQUIRED_INDEXES,
  findBaselineProblems,
  inspectBaseline,
  main,
};
