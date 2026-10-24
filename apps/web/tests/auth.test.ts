import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, newSession, digest } from '../lib/auth';
test('password hashes are salted and verify only the original', async () => {
  const a = await hashPassword('valid-password-01'),
    b = await hashPassword('valid-password-01');
  assert.notEqual(a, b);
  assert.ok(await verifyPassword('valid-password-01', a));
  assert.equal(await verifyPassword('wrong-password', a), false);
  assert.ok(!a.includes('valid-password'));
});
test('session tokens are unpredictable, only hashed tokens are stored', () => {
  const a = newSession(),
    b = newSession();
  assert.notEqual(a, b);
  assert.equal(a.length, 64);
  assert.notEqual(a, digest(a));
});
