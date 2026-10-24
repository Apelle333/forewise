import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export const sessionCookie = 'forewise_session';
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await derive(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  const result = (await derive(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  return result.length === expected.length && timingSafeEqual(result, expected);
}
export function newSession() {
  return randomBytes(32).toString('hex');
}
