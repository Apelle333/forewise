export class BodyTooLargeError extends Error {}

/** Bound accumulated bytes even when Content-Length is absent or incorrect. */
export async function readLimitedBody(request: Request, limit = 1_100_000): Promise<string> {
  if (Number(request.headers.get('content-length') || 0) > limit) throw new BodyTooLargeError();
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks, size).toString('utf8');
  } finally {
    reader.releaseLock();
  }
}
