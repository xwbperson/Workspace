import { createHash, randomUUID } from 'node:crypto';
import type { LoginInput, LoginResponse, SessionView } from '@workspace/client-sdk';
import type { AppConfig } from '../../config.js';
import { AppError, NotFoundError, UnauthorizedError } from '../errors.js';
import {
  createSecretToken,
  hashPassword,
  hashToken,
  tokenHashMatches,
  verifyPassword,
} from './crypto.js';
import { toSessionView, type AuthRepository } from './repository.js';
import { formatSessionCookie, parseSessionCookie } from './session-cookie.js';
import type { AuthenticatedSession, SessionRow } from './types.js';

const OWNER_ID = '00000000-0000-4000-8000-000000000001';
const DAY_MS = 24 * 60 * 60 * 1000;
const LONG_IDLE_MS = 180 * DAY_MS;
const LONG_ABSOLUTE_MS = 365 * DAY_MS;
const TEMP_IDLE_MS = 12 * 60 * 60 * 1000;
const TEMP_ABSOLUTE_MS = 24 * 60 * 60 * 1000;
const ROTATION_MS = 7 * DAY_MS;
const ROTATION_GRACE_MS = 2 * 60 * 1000;
const LONG_RENEWAL_MS = DAY_MS;
const TEMP_RENEWAL_MS = 5 * 60 * 1000;

function minDate(left: Date, right: Date): Date {
  return left.getTime() < right.getTime() ? left : right;
}

function secondsUntil(date: Date, now: Date): number {
  return Math.max(0, Math.floor((date.getTime() - now.getTime()) / 1000));
}

function defaultClientLabel(userAgent: string | undefined): string {
  const agent = userAgent ?? '';
  const browser = agent.includes('Edg/')
    ? 'Edge'
    : agent.includes('Firefox/')
      ? 'Firefox'
      : agent.includes('Chrome/')
        ? 'Chrome'
        : agent.includes('Safari/')
          ? 'Safari'
          : '浏览器';
  const platform = agent.includes('Android')
    ? 'Android'
    : agent.includes('Windows')
      ? 'Windows'
      : agent.includes('Mac OS')
        ? 'macOS'
        : agent.includes('Linux')
          ? 'Linux'
          : '未知系统';
  return `${browser} · ${platform}`;
}

function normalizeClientLabel(input: string | undefined, userAgent: string | undefined): string {
  const label = (input?.trim() || defaultClientLabel(userAgent)).slice(0, 80);
  if (label.length === 0) return '浏览器 · 未知系统';
  return label;
}

export class AuthService {
  public constructor(
    private readonly repository: AuthRepository,
    private readonly config: AppConfig,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async initializeOwner(password: string): Promise<void> {
    if (await this.repository.getOwner()) {
      throw new AppError(409, 'OWNER_ALREADY_INITIALIZED', '固定 owner 账户已经初始化。');
    }
    const passwordHash = await hashPassword(password);
    await this.repository.createOwner(OWNER_ID, passwordHash, this.now());
  }

  public async resetOwnerPassword(password: string): Promise<void> {
    if (!(await this.repository.getOwner())) {
      throw new NotFoundError('固定 owner 账户尚未初始化。');
    }
    const passwordHash = await hashPassword(password);
    const now = this.now();
    await this.repository.updatePassword(passwordHash, now);
    await this.repository.revokeAllSessions(now);
  }

  public async isOwnerInitialized(): Promise<boolean> {
    return (await this.repository.getOwner()) !== null;
  }

  public async login(
    input: LoginInput,
    source: string,
    csrfToken: string,
    userAgent?: string,
  ): Promise<{ response: LoginResponse; cookieValue: string; maxAgeSeconds?: number }> {
    const now = this.now();
    const sourceHash = createHash('sha256').update(source).digest('hex');
    const attempt = await this.repository.getLoginAttempt(sourceHash);
    if (attempt && attempt.failureCount >= 5) {
      const delaySeconds = Math.min(30, 2 ** Math.min(attempt.failureCount - 5, 5));
      const availableAt = attempt.lastFailedAt.getTime() + delaySeconds * 1000;
      if (availableAt > now.getTime()) {
        throw new AppError(429, 'LOGIN_RATE_LIMITED', '登录尝试过于频繁，请稍后再试。', {
          retryAfterSeconds: Math.ceil((availableAt - now.getTime()) / 1000),
        });
      }
    }

    const owner = await this.repository.getOwner();
    const valid =
      input.username === 'owner' && owner
        ? await verifyPassword(owner.passwordHash, input.password)
        : false;
    if (!valid || !owner) {
      await this.repository.recordLoginFailure(sourceHash, now);
      throw new UnauthorizedError('账户或密码不正确。');
    }
    await this.repository.clearLoginFailures(sourceHash);

    const sessionId = randomUUID();
    const token = createSecretToken();
    const absoluteExpiresAt = new Date(
      now.getTime() + (input.remember ? LONG_ABSOLUTE_MS : TEMP_ABSOLUTE_MS),
    );
    const idleExpiresAt = minDate(
      new Date(now.getTime() + (input.remember ? LONG_IDLE_MS : TEMP_IDLE_MS)),
      absoluteExpiresAt,
    );
    const row: SessionRow = {
      sessionId,
      sessionFamilyId: randomUUID(),
      currentTokenHash: hashToken(token),
      previousTokenHash: null,
      previousTokenGraceUntil: null,
      csrfTokenHash: hashToken(csrfToken),
      clientLabel: normalizeClientLabel(input.clientLabel, userAgent),
      remembered: input.remember,
      createdAt: now,
      lastSeenAt: now,
      idleExpiresAt,
      absoluteExpiresAt,
      lastRotatedAt: now,
      revokedAt: null,
    };
    await this.repository.createSession(row);
    const view = toSessionView(row, sessionId);
    const response: LoginResponse = {
      authenticated: true,
      owner: { id: owner.id, username: 'owner' },
      session: view,
    };
    return {
      response,
      cookieValue: formatSessionCookie(sessionId, token),
      ...(input.remember ? { maxAgeSeconds: secondsUntil(idleExpiresAt, now) } : {}),
    };
  }

  public async authenticate(cookieValue: string | undefined): Promise<AuthenticatedSession> {
    const parsed = parseSessionCookie(cookieValue);
    if (!parsed) throw new UnauthorizedError();
    const row = await this.repository.getSession(parsed.sessionId);
    const now = this.now();
    if (
      !row ||
      row.revokedAt ||
      row.idleExpiresAt.getTime() <= now.getTime() ||
      row.absoluteExpiresAt.getTime() <= now.getTime()
    ) {
      throw new UnauthorizedError();
    }

    const currentMatches = tokenHashMatches(parsed.token, row.currentTokenHash);
    const previousMatches =
      row.previousTokenHash !== null &&
      row.previousTokenGraceUntil !== null &&
      row.previousTokenGraceUntil.getTime() > now.getTime() &&
      tokenHashMatches(parsed.token, row.previousTokenHash);
    if (!currentMatches && !previousMatches) throw new UnauthorizedError();

    let replacementCookieValue: string | undefined;
    let replacementCookieMaxAgeSeconds: number | undefined;
    let currentHash = row.currentTokenHash;
    let lastRotatedAt = row.lastRotatedAt;

    if (currentMatches && now.getTime() - row.lastRotatedAt.getTime() >= ROTATION_MS) {
      const nextToken = createSecretToken();
      const nextHash = hashToken(nextToken);
      await this.repository.rotateSession(
        row.sessionId,
        row.currentTokenHash,
        nextHash,
        new Date(now.getTime() + ROTATION_GRACE_MS),
        now,
      );
      currentHash = nextHash;
      lastRotatedAt = now;
      replacementCookieValue = formatSessionCookie(row.sessionId, nextToken);
    }

    const renewalInterval = row.remembered ? LONG_RENEWAL_MS : TEMP_RENEWAL_MS;
    let lastSeenAt = row.lastSeenAt;
    let idleExpiresAt = row.idleExpiresAt;
    if (now.getTime() - row.lastSeenAt.getTime() >= renewalInterval) {
      idleExpiresAt = minDate(
        new Date(now.getTime() + (row.remembered ? LONG_IDLE_MS : TEMP_IDLE_MS)),
        row.absoluteExpiresAt,
      );
      lastSeenAt = now;
      await this.repository.renewSession(row.sessionId, lastSeenAt, idleExpiresAt);
      if (row.remembered) replacementCookieMaxAgeSeconds = secondsUntil(idleExpiresAt, now);
    }

    if (replacementCookieValue && row.remembered && replacementCookieMaxAgeSeconds === undefined) {
      replacementCookieMaxAgeSeconds = secondsUntil(idleExpiresAt, now);
    }

    const updated: SessionRow = {
      ...row,
      currentTokenHash: currentHash,
      lastRotatedAt,
      lastSeenAt,
      idleExpiresAt,
    };
    return {
      auth: {
        userId: OWNER_ID,
        workspaceId: this.config.workspaceId,
        sessionId: row.sessionId,
        sessionFamilyId: row.sessionFamilyId,
        csrfTokenHash: row.csrfTokenHash,
        remembered: row.remembered,
      },
      view: toSessionView(updated, row.sessionId),
      ...(replacementCookieValue ? { replacementCookieValue } : {}),
      ...(replacementCookieMaxAgeSeconds !== undefined ? { replacementCookieMaxAgeSeconds } : {}),
    };
  }

  public async refreshCsrf(
    cookieValue: string | undefined,
    csrfToken: string,
  ): Promise<AuthenticatedSession> {
    const session = await this.authenticate(cookieValue);
    await this.repository.updateCsrfHash(session.auth.sessionId, hashToken(csrfToken));
    return session;
  }

  public csrfMatches(auth: { csrfTokenHash: string }, token: string): boolean {
    return tokenHashMatches(token, auth.csrfTokenHash);
  }

  public async listSessions(currentSessionId: string): Promise<SessionView[]> {
    const rows = await this.repository.listActiveSessions(this.now());
    return rows.map((row) => toSessionView(row, currentSessionId));
  }

  public async renameSession(
    sessionId: string,
    currentSessionId: string,
    clientLabel: string,
  ): Promise<SessionView> {
    const label = clientLabel.trim();
    if (label.length < 1 || label.length > 80) {
      throw new AppError(400, 'INVALID_CLIENT_LABEL', '会话名称需要 1–80 个字符。');
    }
    const row = await this.repository.renameSession(sessionId, label);
    if (!row) throw new NotFoundError('没有找到该登录会话。');
    return toSessionView(row, currentSessionId);
  }

  public async revokeSession(sessionId: string): Promise<void> {
    await this.repository.revokeSession(sessionId, this.now());
  }

  public async logoutFamily(sessionFamilyId: string): Promise<void> {
    await this.repository.revokeFamily(sessionFamilyId, this.now());
  }

  public async logoutOtherSessions(currentFamilyId: string): Promise<void> {
    await this.repository.revokeAllSessions(this.now(), currentFamilyId);
  }

  public async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const owner = await this.repository.getOwner();
    if (!owner || !(await verifyPassword(owner.passwordHash, currentPassword))) {
      throw new UnauthorizedError('当前密码不正确。');
    }
    const passwordHash = await hashPassword(newPassword);
    const now = this.now();
    await this.repository.updatePassword(passwordHash, now);
    await this.repository.revokeAllSessions(now);
  }
}
