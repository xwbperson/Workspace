import type { LifeEvent, LifeEventStatus, LifeProfile } from '@workspace/client-sdk';
import type { Database } from '../../platform/database/types.js';

export interface LifeProfileRow {
  birthDate: string | null;
  expectedAge: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
export interface LifeEventRow {
  id: string;
  title: string;
  targetAt: Date;
  note: string;
  status: LifeEventStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
interface ProfileDatabaseRow {
  birth_date: string | Date | null;
  expected_age: number;
  version: number;
  created_at: Date;
  updated_at: Date;
}
interface EventDatabaseRow {
  id: string;
  title: string;
  target_at: Date;
  note: string;
  status: LifeEventStatus;
  version: number;
  created_at: Date;
  updated_at: Date;
}
const EVENT_COLUMNS = `id,title,target_at,note,status,version,created_at,updated_at`;
function dateOnly(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}
function mapProfile(row: ProfileDatabaseRow): LifeProfileRow {
  return {
    birthDate: dateOnly(row.birth_date),
    expectedAge: row.expected_age,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function mapEvent(row: EventDatabaseRow): LifeEventRow {
  return {
    id: row.id,
    title: row.title,
    targetAt: row.target_at,
    note: row.note,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function expectedEndDate(
  row: Pick<LifeProfileRow, 'birthDate' | 'expectedAge'>,
): string | null {
  if (!row.birthDate) return null;
  const [year, month, day] = row.birthDate.split('-').map(Number) as [number, number, number];
  const targetYear = year + row.expectedAge;
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return `${targetYear.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${Math.min(day, lastDay).toString().padStart(2, '0')}`;
}
export function toLifeProfile(row: LifeProfileRow): LifeProfile {
  return {
    birthDate: row.birthDate,
    expectedAge: row.expectedAge,
    expectedEndDate: expectedEndDate(row),
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}
export function toLifeEvent(row: LifeEventRow): LifeEvent {
  return {
    id: row.id,
    title: row.title,
    targetAt: row.targetAt.toISOString(),
    note: row.note,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class LifeCountdownRepository {
  public constructor(private readonly database: Database) {}
  public async getProfile(): Promise<LifeProfileRow> {
    const result = await this.database.query<ProfileDatabaseRow>(
      `SELECT birth_date,expected_age,version,created_at,updated_at FROM life_profiles WHERE id='owner'`,
    );
    return mapProfile(result.rows[0]!);
  }
  public async updateProfile(row: LifeProfileRow, version: number): Promise<LifeProfileRow | null> {
    const result = await this.database.query<ProfileDatabaseRow>(
      `UPDATE life_profiles SET birth_date=$1,expected_age=$2,version=version+1,updated_at=$3 WHERE id='owner' AND version=$4 RETURNING birth_date,expected_age,version,created_at,updated_at`,
      [row.birthDate, row.expectedAge, row.updatedAt, version],
    );
    return result.rows[0] ? mapProfile(result.rows[0]) : null;
  }
  public async listEvents(status: LifeEventStatus, limit: number): Promise<LifeEventRow[]> {
    const result = await this.database.query<EventDatabaseRow>(
      `SELECT ${EVENT_COLUMNS} FROM life_events WHERE status=$1 ORDER BY target_at ASC,updated_at DESC,id ASC LIMIT $2`,
      [status, limit],
    );
    return result.rows.map(mapEvent);
  }
  public async getEvent(id: string): Promise<LifeEventRow | null> {
    const result = await this.database.query<EventDatabaseRow>(
      `SELECT ${EVENT_COLUMNS} FROM life_events WHERE id=$1`,
      [id],
    );
    return result.rows[0] ? mapEvent(result.rows[0]) : null;
  }
  public async createEvent(row: LifeEventRow): Promise<LifeEventRow> {
    const result = await this.database.query<EventDatabaseRow>(
      `INSERT INTO life_events (id,title,target_at,note,status,version,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${EVENT_COLUMNS}`,
      [
        row.id,
        row.title,
        row.targetAt,
        row.note,
        row.status,
        row.version,
        row.createdAt,
        row.updatedAt,
      ],
    );
    return mapEvent(result.rows[0]!);
  }
  public async updateEvent(row: LifeEventRow, version: number): Promise<LifeEventRow | null> {
    const result = await this.database.query<EventDatabaseRow>(
      `UPDATE life_events SET title=$2,target_at=$3,note=$4,version=version+1,updated_at=$5 WHERE id=$1 AND version=$6 AND status='active' RETURNING ${EVENT_COLUMNS}`,
      [row.id, row.title, row.targetAt, row.note, row.updatedAt, version],
    );
    return result.rows[0] ? mapEvent(result.rows[0]) : null;
  }
  public async setEventArchived(
    id: string,
    version: number,
    archived: boolean,
    now: Date,
  ): Promise<LifeEventRow | null> {
    const result = await this.database.query<EventDatabaseRow>(
      `UPDATE life_events SET status=$3,version=version+1,updated_at=$4 WHERE id=$1 AND version=$2 AND status=$5 RETURNING ${EVENT_COLUMNS}`,
      [id, version, archived ? 'archived' : 'active', now, archived ? 'active' : 'archived'],
    );
    return result.rows[0] ? mapEvent(result.rows[0]) : null;
  }
  public async deleteEvent(id: string, version: number): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM life_events WHERE id=$1 AND version=$2 AND status='archived'`,
      [id, version],
    );
    return (result.rowCount ?? 0) === 1;
  }
  public async upcoming(from: Date, to: Date, limit: number): Promise<LifeEventRow[]> {
    const result = await this.database.query<EventDatabaseRow>(
      `SELECT ${EVENT_COLUMNS} FROM life_events WHERE status='active' AND target_at BETWEEN $1 AND $2 ORDER BY target_at ASC,id ASC LIMIT $3`,
      [from, to, limit],
    );
    return result.rows.map(mapEvent);
  }
  public async recent(limit: number): Promise<LifeEventRow[]> {
    const result = await this.database.query<EventDatabaseRow>(
      `SELECT ${EVENT_COLUMNS} FROM life_events WHERE status='active' ORDER BY updated_at DESC,id ASC LIMIT $1`,
      [limit],
    );
    return result.rows.map(mapEvent);
  }
  public async search(query: string, limit: number): Promise<LifeEventRow[]> {
    const result = await this.database.query<EventDatabaseRow>(
      `SELECT ${EVENT_COLUMNS} FROM life_events WHERE status='active' AND (LOWER(title) LIKE $1 OR LOWER(note) LIKE $1) ORDER BY updated_at DESC,id ASC LIMIT $2`,
      [`%${query.toLocaleLowerCase('zh-CN')}%`, limit],
    );
    return result.rows.map(mapEvent);
  }
}
