ALTER TABLE "CfDocument"
ADD COLUMN "objectKey" TEXT,
ADD COLUMN "bucket" TEXT,
ADD COLUMN "byteSize" INTEGER,
ADD COLUMN "checksum" TEXT,
ADD COLUMN "uploadStatus" TEXT NOT NULL DEFAULT 'ready';

CREATE UNIQUE INDEX "CfDocument_objectKey_key" ON "CfDocument"("objectKey");
CREATE INDEX "CfDocument_organizationId_uploadStatus_idx" ON "CfDocument"("organizationId", "uploadStatus");