import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BodyTooLargeError, readLimitedBody } from '../lib/body';

test('bounded reader accepts an exact-size body', async () => {
  const req = new Request('http://localhost', { method: 'POST', body: 'hello' });
  assert.equal(await readLimitedBody(req, 5), 'hello');
});
test('oversized declared bodies are rejected without reading', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    headers: { 'content-length': '6' },
    body: 'hello!',
  });
  await assert.rejects(readLimitedBody(req, 5), BodyTooLargeError);
  assert.equal(req.bodyUsed, false);
});
test('chunked requests without a length are cancelled as soon as they exceed the limit', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(4));
      controller.enqueue(new Uint8Array(4));
    },
    cancel() {
      cancelled = true;
    },
  });
  const req = new Request('http://localhost', {
    method: 'POST',
    body: stream,
    duplex: 'half',
  } as RequestInit);
  await assert.rejects(readLimitedBody(req, 5), BodyTooLargeError);
  assert.equal(cancelled, true);
});
