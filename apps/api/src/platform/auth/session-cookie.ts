import type { CookieSerializeOptions } from '@fastify/cookie';
import type { AppConfig } from '../../config.js';

export interface ParsedSessionCookie {
  sessionId: string;
  token: string;
}

const SESSION_VALUE_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{40,64})$/i;

export function getCookieNames(config: AppConfig): { session: string; csrf: string } {
  return config.cookieSecure
    ? { session: '__Host-workbench_session', csrf: '__Host-workbench_csrf' }
    : { session: 'workbench_session', csrf: 'workbench_csrf' };
}

export function formatSessionCookie(sessionId: string, token: string): string {
  return `${sessionId}.${token}`;
}

export function parseSessionCookie(value: string | undefined): ParsedSessionCookie | null {
  if (!value) return null;
  const match = SESSION_VALUE_PATTERN.exec(value);
  if (!match?.[1] || !match[2]) return null;
  return { sessionId: match[1], token: match[2] };
}

export function sessionCookieOptions(
  config: AppConfig,
  maxAgeSeconds?: number,
): CookieSerializeOptions {
  const base: CookieSerializeOptions = {
    path: '/',
    secure: config.cookieSecure,
    httpOnly: true,
    sameSite: 'lax',
  };
  if (maxAgeSeconds !== undefined) base.maxAge = Math.max(0, Math.floor(maxAgeSeconds));
  return base;
}

export function csrfCookieOptions(config: AppConfig): CookieSerializeOptions {
  return {
    path: '/',
    secure: config.cookieSecure,
    httpOnly: false,
    sameSite: 'strict',
  };
}
