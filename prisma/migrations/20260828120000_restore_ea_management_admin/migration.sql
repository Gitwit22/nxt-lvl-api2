-- Restore the built-in EA Management administrator without reseeding production data.
UPDATE "AdminUser"
SET "email" = 'eamanagementllc@gmail.com'
WHERE "email" = 'eammanagementllc@gmail.com'
  AND NOT EXISTS (
    SELECT 1
    FROM "AdminUser"
    WHERE "email" = 'eamanagementllc@gmail.com'
  );

INSERT INTO "AdminUser" (
  "id",
  "organizationId",
  "email",
  "passwordHash",
  "firstName",
  "lastName",
  "role",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'cm0eamanagementadmin000000001',
  organization."id",
  'eamanagementllc@gmail.com',
  '$2b$10$jvcfLdgW4KMMhWt0I9M/OODQnbhTO7ORV3t8CIeHV8olIJPduMaI2',
  'EA Management',
  'Admin',
  'org_admin',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" AS organization
WHERE organization."slug" = 'nxt-lvl'
  AND NOT EXISTS (
    SELECT 1
    FROM "AdminUser"
    WHERE "email" = 'eamanagementllc@gmail.com'
  );

UPDATE "AdminUser" AS admin
SET
  "organizationId" = organization."id",
  "passwordHash" = '$2b$10$jvcfLdgW4KMMhWt0I9M/OODQnbhTO7ORV3t8CIeHV8olIJPduMaI2',
  "firstName" = 'EA Management',
  "lastName" = 'Admin',
  "role" = 'org_admin',
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Organization" AS organization
WHERE admin."email" = 'eamanagementllc@gmail.com'
  AND organization."slug" = 'nxt-lvl';

UPDATE "AuthSession"
SET "revokedAt" = CURRENT_TIMESTAMP
WHERE "adminUserId" = (
  SELECT "id"
  FROM "AdminUser"
  WHERE "email" = 'eamanagementllc@gmail.com'
)
  AND "revokedAt" IS NULL;
