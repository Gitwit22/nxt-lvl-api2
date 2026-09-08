-- Run against CLIENTFLOW_DATABASE_URL in the Neon SQL editor.
-- This script is read-only and must not be run against DATABASE_URL.

SELECT
  current_database() AS database_name,
  current_schema() AS schema_name,
  to_regclass('public."CfClient"') IS NOT NULL AS clientflow_schema_present,
  to_regclass('public."Business"') IS NULL AS platform_schema_absent,
  to_regclass('public."AuditLog"') IS NOT NULL AS clientflow_audit_present;

SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
ORDER BY started_at;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name LIKE 'Cf%'
    OR table_name IN ('Organization', 'AdminUser', 'AdminInvitation', 'AuthSession', 'AuditLog')
  )
ORDER BY table_name;

SELECT
  (SELECT COUNT(*) FROM "Organization") AS organizations,
  (SELECT COUNT(*) FROM "AdminUser") AS admin_users,
  (SELECT COUNT(*) FROM "AdminInvitation") AS invitations,
  (SELECT COUNT(*) FROM "AuthSession") AS sessions,
  (SELECT COUNT(*) FROM "CfClient") AS clients,
  (SELECT COUNT(*) FROM "CfProgram") AS programs,
  (SELECT COUNT(*) FROM "CfProgramEnrollment") AS enrollments,
  (SELECT COUNT(*) FROM "CfFormTemplate") AS form_templates,
  (SELECT COUNT(*) FROM "CfFormAssignment") AS form_assignments,
  (SELECT COUNT(*) FROM "CfIntakeSubmission") AS intake_submissions;

SELECT 'AdminUser.organizationId' AS relationship, COUNT(*) AS orphan_count
FROM "AdminUser" child
LEFT JOIN "Organization" parent ON parent.id = child."organizationId"
WHERE parent.id IS NULL
UNION ALL
SELECT 'AuthSession.adminUserId', COUNT(*)
FROM "AuthSession" child
LEFT JOIN "AdminUser" parent ON parent.id = child."adminUserId"
WHERE parent.id IS NULL
UNION ALL
SELECT 'CfClient.organizationId', COUNT(*)
FROM "CfClient" child
LEFT JOIN "Organization" parent ON parent.id = child."organizationId"
WHERE parent.id IS NULL
UNION ALL
SELECT 'CfProgram.organizationId', COUNT(*)
FROM "CfProgram" child
LEFT JOIN "Organization" parent ON parent.id = child."organizationId"
WHERE parent.id IS NULL
UNION ALL
SELECT 'CfProgramEnrollment.clientId', COUNT(*)
FROM "CfProgramEnrollment" child
LEFT JOIN "CfClient" parent ON parent.id = child."clientId"
WHERE parent.id IS NULL
UNION ALL
SELECT 'CfProgramEnrollment.programId', COUNT(*)
FROM "CfProgramEnrollment" child
LEFT JOIN "CfProgram" parent ON parent.id = child."programId"
WHERE parent.id IS NULL
ORDER BY relationship;

SELECT
  organization.id,
  organization.slug,
  organization.status,
  organization."liveMode",
  organization."demoRemovedAt",
  organization."principalAdminId",
  COUNT(admin_user.id) AS admin_count
FROM "Organization" organization
LEFT JOIN "AdminUser" admin_user
  ON admin_user."organizationId" = organization.id
GROUP BY organization.id
ORDER BY organization.slug;