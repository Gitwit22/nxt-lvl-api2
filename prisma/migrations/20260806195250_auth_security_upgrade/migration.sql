-- CreateEnum
CREATE TYPE "ProgramType" AS ENUM ('business_directory', 'youth_database', 'event_directory', 'vendor_directory');

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('draft', 'pending_review', 'published', 'suspended');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('unclaimed', 'claimed', 'verified');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('pending_review', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('pending_review', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "EditTokenPurpose" AS ENUM ('BUSINESS_UPDATE');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('platform_super_admin');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('org_owner', 'org_admin', 'reviewer');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('created', 'updated', 'approved', 'rejected', 'suspended', 'published', 'verified', 'deleted', 'login');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ProgramType" NOT NULL,
    "status" "ProgramStatus" NOT NULL DEFAULT 'draft',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "categories" TEXT[],
    "services" TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "isBlackAmericanOwned" BOOLEAN,
    "ownershipConfirmedAt" TIMESTAMP(3),
    "logoUrl" TEXT,
    "coverImageUrl" TEXT,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "yearEstablished" INTEGER,
    "serviceArea" TEXT,
    "bookingLink" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "linkedin" TEXT,
    "tiktok" TEXT,
    "youtube" TEXT,
    "isOnlineOnly" BOOLEAN,
    "isMobile" BOOLEAN,
    "appointmentRequired" BOOLEAN,
    "deliveryAvailable" BOOLEAN,
    "acceptingNewCustomers" BOOLEAN,
    "businessHours" JSONB,
    "profileCompletionPercentage" INTEGER NOT NULL DEFAULT 0,
    "status" "BusinessStatus" NOT NULL DEFAULT 'draft',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'unclaimed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessContact" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessCategory" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSubmission" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "submittedByName" TEXT,
    "submittedByEmail" TEXT,
    "submittedByPhone" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'pending_review',
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessChangeRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "requestedByName" TEXT,
    "requestedByEmail" TEXT,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'pending_review',
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessEditToken" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "EditTokenPurpose" NOT NULL DEFAULT 'BUSINESS_UPDATE',
    "requestedForEmail" TEXT,
    "requestedByEmail" TEXT,
    "source" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessEditToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "programId" TEXT,
    "actorAdminId" TEXT,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "businessId" TEXT,
    "uploadedById" TEXT,
    "storageProvider" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "publicUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "platformRole" "PlatformRole",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "organizationRole" "OrganizationRole" NOT NULL DEFAULT 'reviewer',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),
    "invitedByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "tokenFamily" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "accessExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CinemaStudioState" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CinemaStudioState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioCoreState" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioCoreState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClipMagicState" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClipMagicState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClipMagicMusicFile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'audio/mpeg',
    "fileSize" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 150,
    "bpm" INTEGER NOT NULL DEFAULT 100,
    "mood" TEXT NOT NULL DEFAULT 'Custom',
    "dataUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClipMagicMusicFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Program_organizationId_idx" ON "Program"("organizationId");

-- CreateIndex
CREATE INDEX "Program_status_idx" ON "Program"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Program_organizationId_slug_key" ON "Program"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "Business_programId_status_idx" ON "Business"("programId", "status");

-- CreateIndex
CREATE INDEX "Business_programId_verificationStatus_idx" ON "Business"("programId", "verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Business_programId_slug_key" ON "Business"("programId", "slug");

-- CreateIndex
CREATE INDEX "BusinessContact_businessId_idx" ON "BusinessContact"("businessId");

-- CreateIndex
CREATE INDEX "BusinessCategory_programId_isActive_idx" ON "BusinessCategory"("programId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessCategory_programId_slug_key" ON "BusinessCategory"("programId", "slug");

-- CreateIndex
CREATE INDEX "BusinessSubmission_programId_status_idx" ON "BusinessSubmission"("programId", "status");

-- CreateIndex
CREATE INDEX "BusinessChangeRequest_businessId_status_idx" ON "BusinessChangeRequest"("businessId", "status");

-- CreateIndex
CREATE INDEX "BusinessEditToken_businessId_idx" ON "BusinessEditToken"("businessId");

-- CreateIndex
CREATE INDEX "BusinessEditToken_expiresAt_idx" ON "BusinessEditToken"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_programId_idx" ON "AuditLog"("programId");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "FileAsset_programId_idx" ON "FileAsset"("programId");

-- CreateIndex
CREATE INDEX "FileAsset_businessId_idx" ON "FileAsset"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AdminUser_platformRole_idx" ON "AdminUser"("platformRole");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_organizationRole_idx" ON "OrganizationMember"("organizationId", "organizationRole");

-- CreateIndex
CREATE INDEX "OrganizationMember_isActive_idx" ON "OrganizationMember"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_adminUserId_organizationId_key" ON "OrganizationMember"("adminUserId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_jti_key" ON "Session"("jti");

-- CreateIndex
CREATE INDEX "Session_adminUserId_idx" ON "Session"("adminUserId");

-- CreateIndex
CREATE INDEX "Session_tokenFamily_idx" ON "Session"("tokenFamily");

-- CreateIndex
CREATE INDEX "Session_accessExpiresAt_idx" ON "Session"("accessExpiresAt");

-- CreateIndex
CREATE INDEX "Session_revokedAt_idx" ON "Session"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CinemaStudioState_workspaceId_key" ON "CinemaStudioState"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "StudioCoreState_workspaceId_key" ON "StudioCoreState"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ClipMagicState_workspaceId_key" ON "ClipMagicState"("workspaceId");

-- CreateIndex
CREATE INDEX "ClipMagicMusicFile_workspaceId_idx" ON "ClipMagicMusicFile"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ClipMagicMusicFile_workspaceId_trackId_key" ON "ClipMagicMusicFile"("workspaceId", "trackId");

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessContact" ADD CONSTRAINT "BusinessContact_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessCategory" ADD CONSTRAINT "BusinessCategory_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessSubmission" ADD CONSTRAINT "BusinessSubmission_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessSubmission" ADD CONSTRAINT "BusinessSubmission_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessChangeRequest" ADD CONSTRAINT "BusinessChangeRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessChangeRequest" ADD CONSTRAINT "BusinessChangeRequest_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessEditToken" ADD CONSTRAINT "BusinessEditToken_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorAdminId_fkey" FOREIGN KEY ("actorAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_invitedByMemberId_fkey" FOREIGN KEY ("invitedByMemberId") REFERENCES "OrganizationMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClipMagicMusicFile" ADD CONSTRAINT "ClipMagicMusicFile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ClipMagicState"("workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
