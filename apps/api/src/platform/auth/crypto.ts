import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';
import { AppError } from '../errors.js';

export function createSecretToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function tokenHashMatches(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function validatePassword(password: string): void {
  if (password.length < 12) {
    throw new AppError(400, 'PASSWORD_TOO_SHORT', '密码至少需要 12 个字符。');
  }
  if (password.length > 128) {
    throw new AppError(400, 'PASSWORD_TOO_LONG', '密码不能超过 128 个字符。');
  }
}

export async function hashPassword(password: string): Promise<string> {
  validatePassword(password);
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
