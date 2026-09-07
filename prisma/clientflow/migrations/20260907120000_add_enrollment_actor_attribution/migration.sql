ALTER TABLE "CfProgramEnrollment"
ADD COLUMN "lastModifiedByUserId" TEXT,
ADD COLUMN "lastModifiedByDisplayName" TEXT;

ALTER TABLE "CfEnrollmentStatusHistory"
ADD COLUMN "changedByDisplayName" TEXT;

CREATE INDEX "CfProgramEnrollment_organizationId_lastModifiedByUserId_idx"
ON "CfProgramEnrollment"("organizationId", "lastModifiedByUserId");