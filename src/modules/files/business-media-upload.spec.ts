import { Module, NotFoundException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { NextFunction, Request, Response } from 'express';
import { GlobalExceptionFilter } from '../../common/filters/global-exception.filter';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';
import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import { BusinessSubmissionsController } from '../business-submissions/business-submissions.controller';
import { BusinessSubmissionsService } from '../business-submissions/business-submissions.service';
import { EditTokensController } from '../edit-tokens/edit-tokens.controller';
import { EditTokensService } from '../edit-tokens/edit-tokens.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService, MAX_IMAGE_UPLOAD_BYTES } from './files.service';

// Exercises the two routes the FBAPP business forms call, over real HTTP + multipart,
// with the same response/exception shaping as main.ts. Only R2 and the DB are mocked.
const validateAndGetBusiness = jest.fn();

@Module({
  controllers: [BusinessSubmissionsController, EditTokensController],
  providers: [
    FilesService,
    { provide: BusinessSubmissionsService, useValue: {} },
    { provide: EditTokensService, useValue: { validateAndGetBusiness } },
    // AdminJwtGuard on the controller's admin routes needs it; the upload routes never do.
    { provide: PrismaService, useValue: {} },
  ],
})
class UploadRoutesModule {}

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

describe('business media upload routes', () => {
  const envKeys = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL'] as const;
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  let app: INestApplication;
  let baseUrl: string;
  let send: jest.SpyInstance;

  beforeAll(async () => {
    process.env['R2_ACCOUNT_ID'] = 'account-id';
    process.env['R2_ACCESS_KEY_ID'] = 'access-key-id';
    process.env['R2_SECRET_ACCESS_KEY'] = 'secret-access-key';
    process.env['R2_BUCKET_NAME'] = 'media-bucket';
    process.env['R2_PUBLIC_URL'] = 'https://media.example.com/';

    app = await NestFactory.create(UploadRoutesModule, { logger: false });
    app.use((request: Request, _response: Response, next: NextFunction) => {
      (request as PartitionRequest).partition = { storageNamespace: 'fbappinc-api2' } as PartitionRequest['partition'];
      next();
    });
    app.setGlobalPrefix('api/v1');
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  beforeEach(() => {
    send = jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);
    validateAndGetBusiness.mockReset().mockResolvedValue({ id: 'business-1' });
  });

  afterEach(() => send.mockRestore());

  afterAll(async () => {
    await app.close();
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const upload = async (path: string, file?: { bytes: Buffer; type: string; name?: string }) => {
    const form = new FormData();
    if (file) form.append('file', new Blob([new Uint8Array(file.bytes)], { type: file.type }), file.name ?? 'My Logo.png');
    const response = await fetch(`${baseUrl}/api/v1${path}`, { method: 'POST', body: form });
    return { status: response.status, body: await response.json() };
  };

  it('stores a signup-form logo and returns its public URL', async () => {
    const { status, body } = await upload(
      '/programs/fba-app/files/upload?subdirectory=business-media/logos',
      { bytes: PNG, type: 'image/png' },
    );

    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.objectKey).toMatch(/^fbappinc-api2\/business-media\/logos\/\d+-[0-9a-f]{8}-my-logo\.png$/);
    expect(body.data.publicUrl).toBe(`https://media.example.com/${body.data.objectKey}`);

    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({ Bucket: 'media-bucket', Key: body.data.objectKey, ContentType: 'image/png' });
    expect(Buffer.from(command.input.Body as Uint8Array).equals(PNG)).toBe(true);
  });

  it('stores an edit-link upload only after validating the token', async () => {
    const { status, body } = await upload(
      '/businesses/edit-session/upload?token=live-token&subdirectory=business-media/covers',
      { bytes: PNG, type: 'image/png' },
    );

    expect(status).toBe(201);
    expect(validateAndGetBusiness).toHaveBeenCalledWith('live-token');
    expect(body.data.objectKey).toContain('fbappinc-api2/business-media/covers/');
  });

  it('rejects an invalid edit link without touching storage', async () => {
    validateAndGetBusiness.mockRejectedValue(new NotFoundException('Edit link not found.'));

    const { status, body } = await upload('/businesses/edit-session/upload?token=bad', { bytes: PNG, type: 'image/png' });

    expect(status).toBe(404);
    expect(body.error).toEqual({ code: 'NOT_FOUND', message: 'Edit link not found.' });
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ['a non-image type', { bytes: Buffer.from('<html></html>'), type: 'text/html' }, 'Only PNG, JPEG, WebP, or GIF images are allowed.'],
    ['an SVG', { bytes: Buffer.from('<svg onload="alert(1)"/>'), type: 'image/svg+xml' }, 'Only PNG, JPEG, WebP, or GIF images are allowed.'],
    ['bytes that do not match the declared type', { bytes: Buffer.from('<script>x</script>'), type: 'image/png' }, 'The file is not a valid image.'],
  ])('rejects %s', async (_label, file, message) => {
    const { status, body } = await upload('/programs/fba-app/files/upload', file);

    expect(status).toBe(400);
    expect(body.error.message).toBe(message);
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects folders outside business media', async () => {
    const { status, body } = await upload('/programs/fba-app/files/upload?subdirectory=../admin', { bytes: PNG, type: 'image/png' });

    expect(status).toBe(400);
    expect(body.error.message).toBe('Invalid upload folder.');
    expect(send).not.toHaveBeenCalled();
  });

  it('requires a file', async () => {
    const { status, body } = await upload('/programs/fba-app/files/upload');

    expect(status).toBe(400);
    expect(body.error.message).toBe('No file provided.');
  });

  it('rejects files over the size limit with a string message', async () => {
    const tooLarge = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_UPLOAD_BYTES)]);

    const { status, body } = await upload('/programs/fba-app/files/upload', { bytes: tooLarge, type: 'image/png' });

    expect(status).toBe(413);
    expect(typeof body.error.message).toBe('string');
    expect(send).not.toHaveBeenCalled();
  });

  it('hides storage errors behind a retryable message', async () => {
    send.mockRejectedValue(new Error('AccessDenied: secret bucket details'));

    const { status, body } = await upload('/programs/fba-app/files/upload', { bytes: PNG, type: 'image/png' });

    expect(status).toBe(503);
    expect(body.error.message).toBe('Image upload failed. Please try again.');
  });
});
