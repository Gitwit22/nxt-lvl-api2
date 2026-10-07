export type LogoImageType = { mimeType: string; extension: string };

export const MAX_LOGO_BYTES = 5 * 1024 * 1024;
// SVG is excluded on purpose: it can carry script.
export const ALLOWED_LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/** Identifies the image from its signature bytes; the client-declared mimetype is not trusted. */
export function detectLogoImage(buffer: Buffer): LogoImageType | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (buffer.length >= 6) {
    const header = buffer.subarray(0, 6).toString('ascii');
    if (header === 'GIF87a' || header === 'GIF89a') return { mimeType: 'image/gif', extension: 'gif' };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  return null;
}
