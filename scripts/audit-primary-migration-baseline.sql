-- Run against the production DATABASE_URL in the Neon SQL editor before
-- resolving any primary migration. This script is read-only.
-- Required platform objects and legacy ClientFlow isolation are reported
-- separately because a clean primary database intentionally has no Cf* tables.

SELECT
  'migration_history_table' AS check_group,
  '_prisma_migrations' AS object_name,
  to_regclass('public._prisma_migrations') IS NOT NULL AS is_present;

-- If the preceding result is true, run this statement separately:
-- SELECT migration_name, checksum, finished_at, rolled_back_at
-- FROM public._prisma_migrations
-- ORDER BY started_at;

WITH expected_columns(migration_name, table_name, column_name) AS (
  VALUES
    ('20260818225500_add_clientflow_live_mode', 'Organization', 'liveMode'),
    ('20260818225500_add_clientflow_live_mode', 'Organization', 'demoRemovedAt'),
    ('20260818225500_add_clientflow_live_mode', 'Organization', 'principalAdminId'),
    ('20260818225500_add_clientflow_live_mode', 'AdminInvitation', 'revokedAt'),
    ('20260831120000_add_refresh_sessions', 'AuthSession', 'refreshTokenHash'),
    ('20260831120000_add_refresh_sessions', 'AuthSession', 'refreshExpiresAt'),
    ('20260831120000_add_refresh_sessions', 'AuthSession', 'refreshRotatedAt'),
    ('20260903120000_add_admin_job_title', 'AdminUser', 'jobTitle')
)
SELECT
  migration_name,
  'column' AS object_type,
  format('%I.%I', table_name, column_name) AS object_name,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND information_schema.columns.table_name = expected_columns.table_name
      AND information_schema.columns.column_name = expected_columns.column_name
  ) AS is_present
FROM expected_columns
ORDER BY migration_name, object_name;

WITH expected_tables(migration_name, table_name) AS (
  VALUES
    ('20260818225500_add_clientflow_live_mode', 'AuthSession')
)
SELECT
  migration_name,
  'table' AS object_type,
  table_name AS object_name,
  EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND information_schema.tables.table_name = expected_tables.table_name
  ) AS is_present
FROM expected_tables
ORDER BY migration_name, object_name;

WITH expected_indexes(migration_name, index_name) AS (
  VALUES
    ('20260818225500_add_clientflow_live_mode', 'Organization_principalAdminId_key'),
    ('20260818225500_add_clientflow_live_mode', 'AuthSession_jti_key'),
    ('20260818225500_add_clientflow_live_mode', 'AuthSession_adminUserId_revokedAt_idx'),
    ('20260818225500_add_clientflow_live_mode', 'AuthSession_expiresAt_idx'),
    ('20260831120000_add_refresh_sessions', 'AuthSession_refreshTokenHash_key'),
    ('20260831120000_add_refresh_sessions', 'AuthSession_refreshExpiresAt_idx')
)
SELECT
  migration_name,
  'index' AS object_type,
  index_name AS object_name,
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND pg_indexes.indexname = expected_indexes.index_name
  ) AS is_present
FROM expected_indexes
ORDER BY migration_name, object_name;

WITH expected_constraints(migration_name, table_name, constraint_name) AS (
  VALUES
    ('20260818225500_add_clientflow_live_mode', 'Organization', 'Organization_principalAdminId_fkey'),
    ('20260818225500_add_clientflow_live_mode', 'AuthSession', 'AuthSession_adminUserId_fkey')
)
SELECT
  migration_name,
  'constraint' AS object_type,
  constraint_name AS object_name,
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conrelid = to_regclass(format('public.%I', expected_constraints.table_name))
      AND conname = expected_constraints.constraint_name
  ) AS is_present
FROM expected_constraints
ORDER BY migration_name, object_name;

SELECT
  table_name,
  'legacy_clientflow_table_must_be_absent' AS check_group,
  false AS isolation_ready
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'Cf%'
ORDER BY table_name;

SELECT
  COUNT(*) = 0 AS clientflow_tables_absent,
  COUNT(*) AS clientflow_table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'Cf%';

-- This intentionally excludes passwordHash.
SELECT
  organization.id IS NOT NULL AS organization_exists,
  organization.status AS organization_status,
  admin_user.id IS NOT NULL AS admin_exists,
  admin_user.role AS admin_role,
  admin_user."isActive" AS admin_is_active
FROM (SELECT 1) AS singleton
LEFT JOIN "Organization" AS organization ON organization.slug = 'nxt-lvl'
LEFT JOIN "AdminUser" AS admin_user
  ON admin_user.email = 'nxtlvltechllc@gmail.com';
