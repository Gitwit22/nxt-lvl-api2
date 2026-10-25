import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Scope,
  ServiceUnavailableException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { S3Client, DeleteObjectCommand, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';

export type FileAction = 'upload' | 'download' | 'delete';

export interface CreateFileUrlInput {
  fileName: string;
  contentType: string;
  action: FileAction;
  expiresInSeconds?: number;
  bucketName?: string;
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

export interface UploadImageInput {
  fileBuffer: Buffer;
  fileName: string;
  contentType: string;
  subdirectory?: string;
}

export interface UploadImageResult {
  publicUrl: string;
  objectKey: string;
}

// Folders the public business forms (signup + edit link) upload into. These
// upload routes are unauthenticated, so callers must not pick arbitrary keys.
export const BUSINESS_MEDIA_SUBDIRECTORIES = [
  'business-media/logos',
  'business-media/covers',
  'business-media/photos',
] as const;

export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

// SVG is deliberately excluded: it can carry script and is served from a public bucket.
const IMAGE_SIGNATURES: Record<string, (bytes: Buffer) => boolean> = {
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/jpeg': (b) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  'image/gif': (b) => ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1')),
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};

export interface StoredObjectMetadata {
  byteSize: number;
  checksum?: string;
  contentType?: string;
}

@Injectable({ scope: Scope.REQUEST })
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly s3Client = this.createClient();

  constructor(@Inject(REQUEST) private readonly request: PartitionRequest) {}

  private get storageNamespace(): string {
    return this.request.partition.storageNamespace;
  }

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
      requestChecksumCalculation: 'WHEN_REQUIRED',
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

    const bucketName = input.bucketName?.trim() || this.getBucketName();
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

  async getObjectMetadata(objectKey: string, bucketName?: string): Promise<StoredObjectMetadata> {
    if (!this.s3Client) {
      throw new ServiceUnavailableException('R2 is not configured.');
    }
    const result = await this.s3Client.send(new HeadObjectCommand({
      Bucket: bucketName?.trim() || this.getBucketName(),
      Key: objectKey,
    }));
    return {
      byteSize: result.ContentLength ?? 0,
      checksum: result.ChecksumSHA256 ?? result.ETag?.replaceAll('"', ''),
      contentType: result.ContentType,
    };
  }

  async deleteObject(objectKey: string, bucketName?: string): Promise<void> {
    if (!this.s3Client) {
      throw new ServiceUnavailableException('R2 is not configured.');
    }
    await this.s3Client.send(new DeleteObjectCommand({
      Bucket: bucketName?.trim() || this.getBucketName(),
      Key: objectKey,
    }));
  }

  /**
   * Stores a business image (logo/cover/photo) from the public forms and returns its public URL.
   * The declared content type is checked against the file's magic bytes so a renamed
   * HTML/script file cannot be stored as an "image".
   */
  async uploadImage(input: UploadImageInput): Promise<UploadImageResult> {
    const subdirectory = input.subdirectory?.trim() || BUSINESS_MEDIA_SUBDIRECTORIES[0];
    if (!(BUSINESS_MEDIA_SUBDIRECTORIES as readonly string[]).includes(subdirectory)) {
      throw new BadRequestException('Invalid upload folder.');
    }

    const matchesSignature = IMAGE_SIGNATURES[input.contentType];
    if (!matchesSignature) {
      throw new BadRequestException('Only PNG, JPEG, WebP, or GIF images are allowed.');
    }
    if (!matchesSignature(input.fileBuffer)) {
      throw new BadRequestException('The file is not a valid image.');
    }
    if (input.fileBuffer.length > MAX_IMAGE_UPLOAD_BYTES) {
      throw new BadRequestException('Images must be 10MB or smaller.');
    }

    const publicUrl = process.env['R2_PUBLIC_URL']?.trim();
    if (!this.s3Client || !publicUrl) {
      throw new ServiceUnavailableException('Image uploads are temporarily unavailable.');
    }

    const objectKey = this.getStorageKey(
      subdirectory,
      `${Date.now()}-${randomUUID().slice(0, 8)}-${this.sanitizeFileName(input.fileName)}`,
    );

    try {
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.getBucketName(),
        Key: objectKey,
        Body: input.fileBuffer,
        ContentType: input.contentType,
      }));
    } catch (error) {
      // Keep R2 details in the logs; the public form only needs a retryable message.
      this.logger.error(
        { message: 'Image upload to storage failed', objectKey, requestId: this.request.requestId },
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException('Image upload failed. Please try again.');
    }

    return { publicUrl: this.getPublicUrl(objectKey) as string, objectKey };
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '') || 'file';
  }
}