import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import { FilesService } from './files.service';

describe('FilesService.createFileUrl', () => {
  const envKeys = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
  ] as const;
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const request = {
    partition: { storageNamespace: 'clientflow-hub' },
  } as unknown as PartitionRequest;

  beforeEach(() => {
    process.env['R2_ACCOUNT_ID'] = 'account-id';
    process.env['R2_ACCESS_KEY_ID'] = 'access-key-id';
    process.env['R2_SECRET_ACCESS_KEY'] = 'secret-access-key';
    process.env['R2_BUCKET_NAME'] = 'fallback-bucket';
  });

  afterAll(() => {
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('presigns an upload for the explicit bucket without optional checksum parameters', async () => {
    const service = new FilesService(request);

    const result = await service.createFileUrl({
      action: 'upload',
      bucketName: 'eamanagement',
      contentType: 'application/pdf',
      expiresInSeconds: 900,
      fileName: 'application.pdf',
      objectKey: 'clientflow-hub/organizations/org-1/documents/document-1',
    });
    const url = new URL(result.url);

    expect(result.bucketName).toBe('eamanagement');
    expect(url.pathname).toBe('/eamanagement/clientflow-hub/organizations/org-1/documents/document-1');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(url.searchParams.get('x-id')).toBe('PutObject');
    expect(url.searchParams.has('x-amz-checksum-crc32')).toBe(false);
    expect(url.searchParams.has('x-amz-sdk-checksum-algorithm')).toBe(false);
  });

  it('falls back to the default bucket when no explicit bucket is supplied', async () => {
    const service = new FilesService(request);

    const result = await service.createFileUrl({
      action: 'download',
      contentType: 'application/pdf',
      fileName: 'application.pdf',
      objectKey: 'clientflow-hub/documents/document-1',
    });

    expect(result.bucketName).toBe('fallback-bucket');
    expect(new URL(result.url).pathname).toBe('/fallback-bucket/clientflow-hub/documents/document-1');
  });
});