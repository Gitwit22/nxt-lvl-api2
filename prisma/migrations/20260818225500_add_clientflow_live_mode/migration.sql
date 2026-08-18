-- Organization live-mode state and retained principal.
ALTER TABLE "Organization"
  ADD COLUMN "liveMode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "demoRemovedAt" TIMESTAMP(3),
  ADD COLUMN "principalAdminId" TEXT;

CREATE UNIQUE INDEX "Organization_principalAdminId_key"
  ON "Organization"("principalAdminId");

ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_principalAdminId_fkey"
  FOREIGN KEY ("principalAdminId") REFERENCES "AdminUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve invitations while allowing outstanding access to be revoked.
ALTER TABLE "AdminInvitation"
  ADD COLUMN "revokedAt" TIMESTAMP(3);

-- Persist JWT sessions so personnel access can be revoked immediately.
CREATE TABLE "AuthSession" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "jti" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthSession_jti_key" ON "AuthSession"("jti");
CREATE INDEX "AuthSession_adminUserId_revokedAt_idx" ON "AuthSession"("adminUserId", "revokedAt");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

ALTER TABLE "AuthSession"
  ADD CONSTRAINT "AuthSession_adminUserId_fkey"
  FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Mark disposable ClientFlow operational demo records server-side.
ALTER TABLE "CfTerms" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CfMonitoringItem" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CfContract" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CfDocument" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CfCommunication" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CfFinalReport" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CfActivityLog" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "CfClient_organizationId_isDemo_idx" ON "CfClient"("organizationId", "isDemo");
CREATE INDEX "CfFormAssignment_organizationId_isDemo_idx" ON "CfFormAssignment"("organizationId", "isDemo");
CREATE INDEX "CfTerms_organizationId_isDemo_idx" ON "CfTerms"("organizationId", "isDemo");
CREATE INDEX "CfMonitoringItem_organizationId_isDemo_idx" ON "CfMonitoringItem"("organizationId", "isDemo");
CREATE INDEX "CfContract_organizationId_isDemo_idx" ON "CfContract"("organizationId", "isDemo");
CREATE INDEX "CfDocument_organizationId_isDemo_idx" ON "CfDocument"("organizationId", "isDemo");
CREATE INDEX "CfCommunication_organizationId_isDemo_idx" ON "CfCommunication"("organizationId", "isDemo");
CREATE INDEX "CfFinalReport_organizationId_isDemo_idx" ON "CfFinalReport"("organizationId", "isDemo");
CREATE INDEX "CfActivityLog_organizationId_isDemo_idx" ON "CfActivityLog"("organizationId", "isDemo");
