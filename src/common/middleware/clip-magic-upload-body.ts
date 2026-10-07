import { json } from 'express';
import type { RequestHandler } from 'express';

// Clip Magic sends music files as base64 data URLs inside JSON (~4/3 of the file size).
// Express's default 100kb JSON limit rejected nearly every real audio file, so this
// route — and only this route — gets a larger limit. All other routes keep the default.
export const CLIP_MAGIC_MUSIC_UPLOAD_PATH = '/api/v1/clip-magic/music/upload';
export const CLIP_MAGIC_MUSIC_UPLOAD_BODY_LIMIT = '30mb';

/**
 * Must be registered with `app.use(...)` before Nest's built-in body parser runs:
 * once this parser has consumed the body, the default parser skips the request.
 */
export function clipMagicMusicUploadBodyParser(): RequestHandler {
  const parser = json({ limit: CLIP_MAGIC_MUSIC_UPLOAD_BODY_LIMIT });

  return (request, response, next) => {
    if (request.method !== 'POST' || !request.path.startsWith(`${CLIP_MAGIC_MUSIC_UPLOAD_PATH}/`)) {
      next();
      return;
    }
    parser(request, response, next);
  };
}
