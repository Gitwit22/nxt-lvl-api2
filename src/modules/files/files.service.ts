import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { S3Client, DeleteObjectCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import programPartition from '../../config/program.partition.json';
import { PrismaService } from '../../prisma/prisma.service';

export type FileAction = 'upload' | 'download' | 'delete';

export interface CreateFileUrlInput {
  fileName: string;
  contentType: string;
  action: FileAction;
  expiresInSeconds?: number;
  objectKey?: string;
  subdirectory?: string;
}

export interface CreateFileUrlResult {
  bucketName: string;
  objectKey: string;
  url: string;
  publicUrl?: string;
  expiresInSeconds: number;
}

export interface CreateFileAssetInput {
  programId?: string;
  businessId?: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  objectKey: string;
  publicUrl?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class FilesService {
  private readonly storageNamespace = programPartition.storageNamespace;
  private readonly s3Client = this.createClient();

  constructor(private readonly prisma: PrismaService) {}

  private createClient(): S3Client | null {
    const accountId = process.env['R2_ACCOUNT_ID']?.trim();
    const accessKeyId = process.env['R2_ACCESS_KEY_ID']?.trim();
    const secretAccessKey = process.env['R2_SECRET_ACCESS_KEY']?.trim();

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return null;
    }

    return new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  getBucketName(): string {
    return process.env['R2_BUCKET_NAME']?.trim() || this.storageNamespace;
  }

  getStorageKey(...segments: string[]): string {
    return [this.storageNamespace, ...segments.map((segment) => segment.trim()).filter(Boolean)].join('/');
  }

  getPublicUrl(objectKey: string): string | undefined {
    const publicUrl = process.env['R2_PUBLIC_URL']?.trim();
    if (!publicUrl) {
      return undefined;
    }

    const baseUrl = publicUrl.replace(/\/+$/, '');
    const key = objectKey.replace(/^\/+/, '');
    return `${baseUrl}/${key}`;
  }

  async createFileUrl(input: CreateFileUrlInput): Promise<CreateFileUrlResult> {
    if (!this.s3Client) {
      throw new ServiceUnavailableException('R2 is not configured.');
    }

    const bucketName = this.getBucketName();
    const objectKey = input.action === 'upload'
      ? (input.objectKey ?? this.getStorageKey(
          input.subdirectory ?? 'files',
          `${Date.now()}-${this.sanitizeFileName(input.fileName)}`,
        ))
      : input.objectKey;

    if (!objectKey) {
      throw new BadRequestException('objectKey is required for this action.');
    }

    const expiresInSeconds = Math.min(Math.max(input.expiresInSeconds ?? 900, 60), 3600);

    let command;
    if (input.action === 'upload') {
      command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ContentType: input.contentType,
      });
    } else if (input.action === 'download') {
      command = new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      });
    } else {
      command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      });
    }

    const url = await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });

    return {
      bucketName,
      objectKey,
      url,
      publicUrl: this.getPublicUrl(objectKey),
      expiresInSeconds,
    };
  }

  private static readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  ];

  async uploadFile(input: {
    fileBuffer: Buffer;
    fileName: string;
    contentType: string;
    subdirectory?: string;
  }): Promise<{ publicUrl: string; objectKey: string }> {
    if (!this.s3Client) {
      throw new ServiceUnavailableException('R2 is not configured.');
    }
    if (!FilesService.ALLOWED_IMAGE_TYPES.includes(input.contentType)) {
      throw new BadRequestException('Only image files are allowed.');
    }

    const objectKey = this.getStorageKey(
      input.subdirectory ?? 'files',
      `${Date.now()}-${this.sanitizeFileName(input.fileName)}`,
    );

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.getBucketName(),
        Key: objectKey,
        Body: input.fileBuffer,
        ContentType: input.contentType,
      }),
    );

    const publicUrl = this.getPublicUrl(objectKey);
    if (!publicUrl) {
      throw new ServiceUnavailableException('R2_PUBLIC_URL is not configured.');
    }

    return { publicUrl, objectKey };
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '') || 'file';
  }

  async createFileAsset(adminId: string, input: CreateFileAssetInput) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { organizationId: true },
    });
    if (!admin) throw new NotFoundException('Admin not found.');

    let programId = input.programId;
    if (!programId) {
      const program = await this.prisma.program.findFirst({
        where: { organizationId: admin.organizationId, status: 'active' },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!program) throw new BadRequestException('No active program found for your organization.');
      programId = program.id;
    }

    return this.prisma.fileAsset.create({
      data: {
        programId,
        businessId: input.businessId ?? null,
        uploadedById: adminId,
        storageProvider: 'r2',
        bucket: this.getBucketName(),
        objectKey: input.objectKey,
        mimeType: input.contentType,
        sizeBytes: input.sizeBytes,
        publicUrl: input.publicUrl ?? this.getPublicUrl(input.objectKey) ?? null,
        metadata: (input.metadata ?? null) as Parameters<typeof this.prisma.fileAsset.create>[0]['data']['metadata'],
      },
    });
  }

  async listFileAssets(adminId: string) {
    return this.prisma.fileAsset.findMany({
      where: { uploadedById: adminId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        objectKey: true,
        mimeType: true,
        sizeBytes: true,
        publicUrl: true,
        createdAt: true,
        metadata: true,
      },
    });
  }

  async deleteFileAsset(id: string, adminId: string) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('File not found.');

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    const isOwner = asset.uploadedById === adminId;
    const isPrivileged = admin && ['super_admin', 'org_admin'].includes(admin.role);
    if (!isOwner && !isPrivileged) throw new ForbiddenException('Not allowed to delete this file.');

    await this.prisma.fileAsset.delete({ where: { id } });
    return { id, objectKey: asset.objectKey };
  }
}