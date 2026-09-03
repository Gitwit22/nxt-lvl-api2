UPDATE "Organization"
SET "status" = 'active', "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'nxt-lvl';

INSERT INTO "AdminUser" (
  "id", "organizationId", "email", "passwordHash", "firstName", "lastName",
  "role", "isActive", "createdAt", "updatedAt"
)
SELECT
  'seed-platform-admin',
  "id",
  'nxtlvltechllc@gmail.com',
  '$2b$12$sixUVJAWPY43D2sL1CxJHep4pzlxitk1Zm6Ko7pN8eDCRYz5EIqmm',
  'Platform',
  'Admin',
  'super_admin',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization"
WHERE "slug" = 'nxt-lvl'
ON CONFLICT ("email") DO UPDATE SET
  "organizationId" = EXCLUDED."organizationId",
  "passwordHash" = EXCLUDED."passwordHash",
  "role" = 'super_admin',
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
