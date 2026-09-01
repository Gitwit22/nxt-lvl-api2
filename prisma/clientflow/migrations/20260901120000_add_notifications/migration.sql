CREATE TABLE "CfNotification" (
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
);

CREATE UNIQUE INDEX "CfNotification_recipientAdminId_sourceType_sourceId_key"
ON "CfNotification"("recipientAdminId", "sourceType", "sourceId");

CREATE INDEX "CfNotification_organizationId_recipientAdminId_createdAt_idx"
ON "CfNotification"("organizationId", "recipientAdminId", "createdAt");

CREATE INDEX "CfNotification_organizationId_recipientAdminId_readAt_idx"
ON "CfNotification"("organizationId", "recipientAdminId", "readAt");

CREATE INDEX "CfNotification_organizationId_isDemo_idx"
ON "CfNotification"("organizationId", "isDemo");

ALTER TABLE "CfNotification"
ADD CONSTRAINT "CfNotification_recipientAdminId_fkey"
FOREIGN KEY ("recipientAdminId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
