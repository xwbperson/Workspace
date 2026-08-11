import type { Countdown } from '@workspace/client-sdk';
import type { Database } from '../../platform/database/types.js';

export interface CountdownRow {
  id: string;
  title: string;
  note: string;
  targetAt: Date;
  status: 'active' | 'completed' | 'archived';
  priority: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CountdownDatabaseRow {
  id: string;
  title: string;
  note: string;
  target_at: Date;
  status: 'active' | 'completed' | 'archived';
  priority: number;
  version: number;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: CountdownDatabaseRow): CountdownRow {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    targetAt: row.target_at,
    status: row.status,
    priority: row.priority,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCountdown(row: CountdownRow): Countdown {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    targetAt: row.targetAt.toISOString(),
    status: row.status,
    priority: row.priority,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class CountdownRepository {
  public constructor(private readonly database: Database) {}

  public async list(input: {
    status: CountdownRow['status'];
    limit: number;
    afterTargetAt?: Date;
    afterId?: string;
  }): Promise<CountdownRow[]> {
    const result = await this.database.query<CountdownDatabaseRow>(
      `SELECT id, title, note, target_at, status, priority, version, created_at, updated_at
       FROM countdowns
       WHERE status = $1
         AND (
           $2::timestamptz IS NULL
           OR target_at > $2::timestamptz
           OR (target_at = $2::timestamptz AND id > $3::uuid)
         )
       ORDER BY target_at ASC, id ASC
       LIMIT $4`,
      [input.status, input.afterTargetAt ?? null, input.afterId ?? null, input.limit],
    );
    return result.rows.map(mapRow);
  }

  public async get(id: string): Promise<CountdownRow | null> {
    const result = await this.database.query<CountdownDatabaseRow>(
      `SELECT id, title, note, target_at, status, priority, version, created_at, updated_at
       FROM countdowns WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public async create(row: CountdownRow): Promise<CountdownRow> {
    const result = await this.database.query<CountdownDatabaseRow>(
      `INSERT INTO countdowns
         (id, title, note, target_at, status, priority, version, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, title, note, target_at, status, priority, version, created_at, updated_at`,
      [
        row.id,
        row.title,
        row.note,
        row.targetAt,
        row.status,
        row.priority,
        row.version,
        row.createdAt,
        row.updatedAt,
      ],
    );
    return mapRow(result.rows[0]!);
  }

  public async update(row: CountdownRow, expectedVersion: number): Promise<CountdownRow | null> {
    const result = await this.database.query<CountdownDatabaseRow>(
      `UPDATE countdowns
       SET title = $2, note = $3, target_at = $4, status = $5, priority = $6,
           version = version + 1, updated_at = $7
       WHERE id = $1 AND version = $8 AND status <> 'archived'
       RETURNING id, title, note, target_at, status, priority, version, created_at, updated_at`,
      [
        row.id,
        row.title,
        row.note,
        row.targetAt,
        row.status,
        row.priority,
        row.updatedAt,
        expectedVersion,
      ],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public async archive(id: string, expectedVersion: number, now: Date): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE countdowns
       SET status = 'archived', version = version + 1, updated_at = $3
       WHERE id = $1 AND version = $2 AND status <> 'archived'`,
      [id, expectedVersion, now],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async upcoming(input: { from: Date; to: Date; limit: number }): Promise<CountdownRow[]> {
    const result = await this.database.query<CountdownDatabaseRow>(
      `SELECT id, title, note, target_at, status, priority, version, created_at, updated_at
       FROM countdowns
       WHERE status = 'active' AND target_at >= $1 AND target_at <= $2
       ORDER BY target_at ASC, priority DESC, id ASC
       LIMIT $3`,
      [input.from, input.to, input.limit],
    );
    return result.rows.map(mapRow);
  }

  public async nearestActive(limit: number): Promise<CountdownRow[]> {
    const result = await this.database.query<CountdownDatabaseRow>(
      `SELECT id, title, note, target_at, status, priority, version, created_at, updated_at
       FROM countdowns
       WHERE status = 'active'
       ORDER BY CASE WHEN target_at >= now() THEN 0 ELSE 1 END,
                CASE WHEN target_at >= now() THEN target_at END ASC,
                CASE WHEN target_at < now() THEN target_at END DESC,
                priority DESC,
                id ASC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map(mapRow);
  }

  public async recent(limit: number): Promise<CountdownRow[]> {
    const result = await this.database.query<CountdownDatabaseRow>(
      `SELECT id, title, note, target_at, status, priority, version, created_at, updated_at
       FROM countdowns
       WHERE status <> 'archived'
       ORDER BY updated_at DESC, id ASC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map(mapRow);
  }

  public async search(query: string, limit: number): Promise<CountdownRow[]> {
    const pattern = `%${query.toLocaleLowerCase('zh-CN')}%`;
    const result = await this.database.query<CountdownDatabaseRow>(
      `SELECT id, title, note, target_at, status, priority, version, created_at, updated_at
       FROM countdowns
       WHERE status <> 'archived'
         AND (LOWER(title) LIKE $1 OR LOWER(note) LIKE $1)
       ORDER BY updated_at DESC, id ASC
       LIMIT $2`,
      [pattern, limit],
    );
    return result.rows.map(mapRow);
  }

  public async reachedWithoutNotification(limit: number): Promise<CountdownRow[]> {
    const result = await this.database.query<CountdownDatabaseRow>(
      `SELECT c.id, c.title, c.note, c.target_at, c.status, c.priority,
              c.version, c.created_at, c.updated_at
       FROM countdowns c
       LEFT JOIN workbench_notifications n
         ON n.notification_id = 'countdown-reached:' || c.id::text
       WHERE c.status = 'active' AND c.target_at <= now() AND n.notification_id IS NULL
       ORDER BY c.target_at ASC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map(mapRow);
  }
}
