import type { SessionView } from '@workspace/client-sdk';
import type { Database } from '../database/types.js';
import type { OwnerRow, SessionRow } from './types.js';

interface OwnerDatabaseRow {
  id: string;
  username: 'owner';
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

interface SessionDatabaseRow {
  session_id: string;
  session_family_id: string;
  current_token_hash: string;
  previous_token_hash: string | null;
  previous_token_grace_until: Date | null;
  csrf_token_hash: string;
  client_label: string;
  remembered: boolean;
  created_at: Date;
  last_seen_at: Date;
  idle_expires_at: Date;
  absolute_expires_at: Date;
  last_rotated_at: Date;
  revoked_at: Date | null;
}

function mapOwner(row: OwnerDatabaseRow): OwnerRow {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSession(row: SessionDatabaseRow): SessionRow {
  return {
    sessionId: row.session_id,
    sessionFamilyId: row.session_family_id,
    currentTokenHash: row.current_token_hash,
    previousTokenHash: row.previous_token_hash,
    previousTokenGraceUntil: row.previous_token_grace_until,
    csrfTokenHash: row.csrf_token_hash,
    clientLabel: row.client_label,
    remembered: row.remembered,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    idleExpiresAt: row.idle_expires_at,
    absoluteExpiresAt: row.absolute_expires_at,
    lastRotatedAt: row.last_rotated_at,
    revokedAt: row.revoked_at,
  };
}

export function toSessionView(row: SessionRow, currentSessionId: string): SessionView {
  return {
    sessionId: row.sessionId,
    clientLabel: row.clientLabel,
    current: row.sessionId === currentSessionId,
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    idleExpiresAt: row.idleExpiresAt.toISOString(),
    absoluteExpiresAt: row.absoluteExpiresAt.toISOString(),
    remembered: row.remembered,
  };
}

export class AuthRepository {
  public constructor(private readonly database: Database) {}

  public async getOwner(): Promise<OwnerRow | null> {
    const result = await this.database.query<OwnerDatabaseRow>(
      `SELECT id, username, password_hash, created_at, updated_at
       FROM owner_account WHERE username = 'owner'`,
    );
    return result.rows[0] ? mapOwner(result.rows[0]) : null;
  }

  public async createOwner(id: string, passwordHash: string, now: Date): Promise<OwnerRow> {
    const result = await this.database.query<OwnerDatabaseRow>(
      `INSERT INTO owner_account (id, username, password_hash, created_at, updated_at)
       VALUES ($1, 'owner', $2, $3, $3)
       RETURNING id, username, password_hash, created_at, updated_at`,
      [id, passwordHash, now],
    );
    return mapOwner(result.rows[0]!);
  }

  public async updatePassword(passwordHash: string, now: Date): Promise<void> {
    await this.database.query(
      `UPDATE owner_account SET password_hash = $1, updated_at = $2 WHERE username = 'owner'`,
      [passwordHash, now],
    );
  }

  public async createSession(row: SessionRow): Promise<void> {
    await this.database.query(
      `INSERT INTO auth_sessions (
         session_id, session_family_id, current_token_hash, previous_token_hash,
         previous_token_grace_until, csrf_token_hash, client_label, remembered,
         created_at, last_seen_at, idle_expires_at, absolute_expires_at,
         last_rotated_at, revoked_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        row.sessionId,
        row.sessionFamilyId,
        row.currentTokenHash,
        row.previousTokenHash,
        row.previousTokenGraceUntil,
        row.csrfTokenHash,
        row.clientLabel,
        row.remembered,
        row.createdAt,
        row.lastSeenAt,
        row.idleExpiresAt,
        row.absoluteExpiresAt,
        row.lastRotatedAt,
        row.revokedAt,
      ],
    );
  }

  public async getSession(sessionId: string): Promise<SessionRow | null> {
    const result = await this.database.query<SessionDatabaseRow>(
      `SELECT session_id, session_family_id, current_token_hash, previous_token_hash,
              previous_token_grace_until, csrf_token_hash, client_label, remembered,
              created_at, last_seen_at, idle_expires_at, absolute_expires_at,
              last_rotated_at, revoked_at
       FROM auth_sessions WHERE session_id = $1`,
      [sessionId],
    );
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  }

  public async rotateSession(
    sessionId: string,
    currentHash: string,
    nextHash: string,
    graceUntil: Date,
    now: Date,
  ): Promise<boolean> {
    const result = await this.database.query<{ session_id: string }>(
      `UPDATE auth_sessions
       SET previous_token_hash = $2,
           previous_token_grace_until = $3,
           current_token_hash = $4,
           last_rotated_at = $5
       WHERE session_id = $1 AND current_token_hash = $2 AND revoked_at IS NULL
       RETURNING session_id`,
      [sessionId, currentHash, graceUntil, nextHash, now],
    );
    return result.rows.length === 1;
  }

  public async renewSession(
    sessionId: string,
    lastSeenAt: Date,
    idleExpiresAt: Date,
  ): Promise<void> {
    await this.database.query(
      `UPDATE auth_sessions
       SET last_seen_at = $2, idle_expires_at = $3
       WHERE session_id = $1 AND revoked_at IS NULL`,
      [sessionId, lastSeenAt, idleExpiresAt],
    );
  }

  public async updateCsrfHash(sessionId: string, csrfTokenHash: string): Promise<void> {
    await this.database.query(
      'UPDATE auth_sessions SET csrf_token_hash = $2 WHERE session_id = $1 AND revoked_at IS NULL',
      [sessionId, csrfTokenHash],
    );
  }

  public async listActiveSessions(now: Date): Promise<SessionRow[]> {
    const result = await this.database.query<SessionDatabaseRow>(
      `SELECT session_id, session_family_id, current_token_hash, previous_token_hash,
              previous_token_grace_until, csrf_token_hash, client_label, remembered,
              created_at, last_seen_at, idle_expires_at, absolute_expires_at,
              last_rotated_at, revoked_at
       FROM auth_sessions
       WHERE revoked_at IS NULL AND idle_expires_at > $1 AND absolute_expires_at > $1
       ORDER BY last_seen_at DESC`,
      [now],
    );
    return result.rows.map(mapSession);
  }

  public async renameSession(sessionId: string, clientLabel: string): Promise<SessionRow | null> {
    const result = await this.database.query<SessionDatabaseRow>(
      `UPDATE auth_sessions SET client_label = $2
       WHERE session_id = $1 AND revoked_at IS NULL
       RETURNING session_id, session_family_id, current_token_hash, previous_token_hash,
                 previous_token_grace_until, csrf_token_hash, client_label, remembered,
                 created_at, last_seen_at, idle_expires_at, absolute_expires_at,
                 last_rotated_at, revoked_at`,
      [sessionId, clientLabel],
    );
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  }

  public async revokeFamily(sessionFamilyId: string, now: Date): Promise<void> {
    await this.database.query(
      `UPDATE auth_sessions
       SET revoked_at = $2, previous_token_hash = NULL, previous_token_grace_until = NULL
       WHERE session_family_id = $1 AND revoked_at IS NULL`,
      [sessionFamilyId, now],
    );
  }

  public async revokeSession(sessionId: string, now: Date): Promise<void> {
    await this.database.query(
      `UPDATE auth_sessions
       SET revoked_at = $2, previous_token_hash = NULL, previous_token_grace_until = NULL
       WHERE session_id = $1 AND revoked_at IS NULL`,
      [sessionId, now],
    );
  }

  public async revokeAllSessions(now: Date, exceptFamilyId?: string): Promise<void> {
    if (exceptFamilyId) {
      await this.database.query(
        `UPDATE auth_sessions
         SET revoked_at = $2, previous_token_hash = NULL, previous_token_grace_until = NULL
         WHERE revoked_at IS NULL AND session_family_id <> $1`,
        [exceptFamilyId, now],
      );
      return;
    }
    await this.database.query(
      `UPDATE auth_sessions
       SET revoked_at = $1, previous_token_hash = NULL, previous_token_grace_until = NULL
       WHERE revoked_at IS NULL`,
      [now],
    );
  }

  public async getLoginAttempt(
    sourceHash: string,
  ): Promise<{ failureCount: number; lastFailedAt: Date } | null> {
    const result = await this.database.query<{
      failure_count: number;
      last_failed_at: Date;
    }>('SELECT failure_count, last_failed_at FROM auth_login_attempts WHERE source_hash = $1', [
      sourceHash,
    ]);
    const row = result.rows[0];
    return row ? { failureCount: row.failure_count, lastFailedAt: row.last_failed_at } : null;
  }

  public async recordLoginFailure(sourceHash: string, now: Date): Promise<void> {
    await this.database.query(
      `INSERT INTO auth_login_attempts (source_hash, failure_count, last_failed_at)
       VALUES ($1, 1, $2)
       ON CONFLICT (source_hash) DO UPDATE
       SET failure_count = auth_login_attempts.failure_count + 1, last_failed_at = $2`,
      [sourceHash, now],
    );
  }

  public async clearLoginFailures(sourceHash: string): Promise<void> {
    await this.database.query('DELETE FROM auth_login_attempts WHERE source_hash = $1', [
      sourceHash,
    ]);
  }
}
