export class BodyTooLargeError extends Error {}

/** Bound accumulated bytes even when Content-Length is absent or incorrect. */
export async function readLimitedBytes(request: Request, limit = 1_100_000): Promise<Buffer> {
  if (Number(request.headers.get('content-length') || 0) > limit) throw new BodyTooLargeError();
  if (!request.body) return Buffer.alloc(0);
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
    return Buffer.concat(chunks, size);
  } finally {
    reader.releaseLock();
  }
}

export async function readLimitedBody(request: Request, limit = 1_100_000): Promise<string> {
  return (await readLimitedBytes(request, limit)).toString('utf8');
}
