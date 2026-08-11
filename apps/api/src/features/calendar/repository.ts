import type { CalendarEntry, CalendarEntryStatus, CalendarEntryType } from '@workspace/client-sdk';
import type { Database } from '../../platform/database/types.js';

export interface CalendarEntryRow {
  id: string;
  type: CalendarEntryType;
  title: string;
  content: string;
  entryDate: string;
  startsAt: Date | null;
  endsAt: Date | null;
  status: CalendarEntryStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CalendarEntryDatabaseRow {
  id: string;
  type: CalendarEntryType;
  title: string;
  content: string;
  entry_date: string | Date;
  starts_at: Date | null;
  ends_at: Date | null;
  status: CalendarEntryStatus;
  version: number;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `id,type,title,content,entry_date,starts_at,ends_at,status,version,created_at,updated_at`;

function dateOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function mapRow(row: CalendarEntryDatabaseRow): CalendarEntryRow {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    entryDate: dateOnly(row.entry_date),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCalendarEntry(row: CalendarEntryRow): CalendarEntry {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    entryDate: row.entryDate,
    ...(row.startsAt ? { startsAt: row.startsAt.toISOString() } : {}),
    ...(row.endsAt ? { endsAt: row.endsAt.toISOString() } : {}),
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class CalendarRepository {
  public constructor(private readonly database: Database) {}

  public async list(input: {
    from: string;
    to: string;
    status: CalendarEntryStatus;
    limit: number;
  }): Promise<CalendarEntryRow[]> {
    const result = await this.database.query<CalendarEntryDatabaseRow>(
      `SELECT ${COLUMNS} FROM calendar_entries
       WHERE status=$1 AND entry_date BETWEEN $2 AND $3
       ORDER BY entry_date ASC,starts_at ASC NULLS LAST,created_at ASC,id ASC LIMIT $4`,
      [input.status, input.from, input.to, input.limit],
    );
    return result.rows.map(mapRow);
  }

  public async get(id: string): Promise<CalendarEntryRow | null> {
    const result = await this.database.query<CalendarEntryDatabaseRow>(
      `SELECT ${COLUMNS} FROM calendar_entries WHERE id=$1`,
      [id],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public async create(row: CalendarEntryRow): Promise<CalendarEntryRow> {
    const result = await this.database.query<CalendarEntryDatabaseRow>(
      `INSERT INTO calendar_entries
         (id,type,title,content,entry_date,starts_at,ends_at,status,version,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ${COLUMNS}`,
      [
        row.id,
        row.type,
        row.title,
        row.content,
        row.entryDate,
        row.startsAt,
        row.endsAt,
        row.status,
        row.version,
        row.createdAt,
        row.updatedAt,
      ],
    );
    return mapRow(result.rows[0]!);
  }

  public async update(row: CalendarEntryRow, version: number): Promise<CalendarEntryRow | null> {
    const result = await this.database.query<CalendarEntryDatabaseRow>(
      `UPDATE calendar_entries SET type=$2,title=$3,content=$4,entry_date=$5,starts_at=$6,
         ends_at=$7,version=version+1,updated_at=$8
       WHERE id=$1 AND version=$9 AND status='active' RETURNING ${COLUMNS}`,
      [
        row.id,
        row.type,
        row.title,
        row.content,
        row.entryDate,
        row.startsAt,
        row.endsAt,
        row.updatedAt,
        version,
      ],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public async archive(id: string, version: number, now: Date): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE calendar_entries SET status='archived',version=version+1,updated_at=$3
       WHERE id=$1 AND version=$2 AND status='active'`,
      [id, version, now],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async restore(id: string, version: number, now: Date): Promise<CalendarEntryRow | null> {
    const result = await this.database.query<CalendarEntryDatabaseRow>(
      `UPDATE calendar_entries SET status='active',version=version+1,updated_at=$3
       WHERE id=$1 AND version=$2 AND status='archived' RETURNING ${COLUMNS}`,
      [id, version, now],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public async deletePermanently(id: string, version: number): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM calendar_entries WHERE id=$1 AND version=$2 AND status='archived'`,
      [id, version],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async upcoming(from: Date, to: Date, limit: number): Promise<CalendarEntryRow[]> {
    const result = await this.database.query<CalendarEntryDatabaseRow>(
      `SELECT ${COLUMNS} FROM calendar_entries WHERE status='active' AND type='schedule'
       AND starts_at BETWEEN $1 AND $2 ORDER BY starts_at ASC,id ASC LIMIT $3`,
      [from, to, limit],
    );
    return result.rows.map(mapRow);
  }

  public async recent(limit: number): Promise<CalendarEntryRow[]> {
    const result = await this.database.query<CalendarEntryDatabaseRow>(
      `SELECT ${COLUMNS} FROM calendar_entries WHERE status='active'
       ORDER BY updated_at DESC,id ASC LIMIT $1`,
      [limit],
    );
    return result.rows.map(mapRow);
  }

  public async search(query: string, limit: number): Promise<CalendarEntryRow[]> {
    const pattern = `%${query.toLocaleLowerCase('zh-CN')}%`;
    const result = await this.database.query<CalendarEntryDatabaseRow>(
      `SELECT ${COLUMNS} FROM calendar_entries WHERE status='active'
       AND (LOWER(title) LIKE $1 OR LOWER(content) LIKE $1)
       ORDER BY updated_at DESC,id ASC LIMIT $2`,
      [pattern, limit],
    );
    return result.rows.map(mapRow);
  }
}
