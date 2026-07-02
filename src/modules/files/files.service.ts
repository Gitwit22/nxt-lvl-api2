import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { S3Client, DeleteObjectCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import programPartition from '../../config/program.partition.json';

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

@Injectable()
export class FilesService {
  private readonly storageNamespace = programPartition.storageNamespace;
  private readonly s3Client = this.createClient();

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

  private sanitizeFileName(fileName: string): string {
    return fileName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '') || 'file';
  }
}