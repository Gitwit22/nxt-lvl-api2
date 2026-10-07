import { Body, Controller, Module, Param, Post } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { clipMagicMusicUploadBodyParser } from './clip-magic-upload-body';

@Controller('clip-magic')
class UploadProbeController {
  @Post('music/upload/:workspaceId')
  upload(@Param('workspaceId') workspaceId: string, @Body() body: { dataUrl: string }) {
    return { workspaceId, received: body.dataUrl.length };
  }

  @Post('state/:workspaceId')
  other(@Body() body: { dataUrl: string }) {
    return { received: body.dataUrl.length };
  }
}

@Module({ controllers: [UploadProbeController] })
class UploadProbeModule {}

describe('clipMagicMusicUploadBodyParser', () => {
  let app: INestApplication;
  let baseUrl: string;
  // ~1MB: well over Express's 100kb default, well under the upload limit.
  const largeBody = { dataUrl: `data:audio/mpeg;base64,${'A'.repeat(1024 * 1024)}` };

  beforeAll(async () => {
    app = await NestFactory.create(UploadProbeModule, { logger: false });
    app.use(clipMagicMusicUploadBodyParser());
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  const post = async (path: string, body: unknown) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as unknown };
  };

  afterAll(async () => {
    await app.close();
  });

  it('accepts a large JSON body on the music upload route', async () => {
    const response = await post('/api/v1/clip-magic/music/upload/ws-1', largeBody);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ workspaceId: 'ws-1', received: largeBody.dataUrl.length });
  });

  it('keeps the default limit on every other route', async () => {
    const response = await post('/api/v1/clip-magic/state/ws-1', largeBody);

    expect(response.status).toBe(413);
  });

  it('still rejects bodies above the upload limit', async () => {
    const response = await post('/api/v1/clip-magic/music/upload/ws-1', {
      dataUrl: 'A'.repeat(31 * 1024 * 1024),
    });

    expect(response.status).toBe(413);
  });
});
