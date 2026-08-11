import type { Task, TaskPriority, TaskRecurrence, TaskStatus } from '@workspace/client-sdk';
import type { Database, DatabaseClient } from '../../platform/database/types.js';

export interface TaskRow {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  archivedFromStatus: Exclude<TaskStatus, 'archived'> | null;
  priority: TaskPriority;
  dueAt: Date | null;
  recurrence: TaskRecurrence;
  parentId: string | null;
  recurrenceSourceId: string | null;
  completedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

interface TaskDatabaseRow {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  archived_from_status: Exclude<TaskStatus, 'archived'> | null;
  priority: TaskPriority;
  due_at: Date | null;
  recurrence: TaskRecurrence;
  parent_id: string | null;
  recurrence_source_id: string | null;
  completed_at: Date | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

const TASK_COLUMNS = `id,title,description,status,archived_from_status,priority,due_at,
  recurrence,parent_id,recurrence_source_id,completed_at,version,created_at,updated_at`;

function mapRow(row: TaskDatabaseRow): TaskRow {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    archivedFromStatus: row.archived_from_status,
    priority: row.priority,
    dueAt: row.due_at,
    recurrence: row.recurrence,
    parentId: row.parent_id,
    recurrenceSourceId: row.recurrence_source_id,
    completedAt: row.completed_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    ...(row.dueAt ? { dueAt: row.dueAt.toISOString() } : {}),
    recurrence: row.recurrence,
    parentId: row.parentId,
    recurrenceSourceId: row.recurrenceSourceId,
    ...(row.completedAt ? { completedAt: row.completedAt.toISOString() } : {}),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function rollback(client: DatabaseClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Preserve the original transaction error.
  }
}

export class TaskRepository {
  public constructor(private readonly database: Database) {}

  public async list(status: TaskStatus | 'open', limit: number): Promise<TaskRow[]> {
    const open = status === 'open';
    const result = await this.database.query<TaskDatabaseRow>(
      `SELECT ${TASK_COLUMNS} FROM tasks
       WHERE ${open ? "status IN ('todo','in-progress')" : 'status=$1'}
       ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                due_at ASC NULLS LAST,created_at ASC,id ASC LIMIT $${open ? 1 : 2}`,
      open ? [limit] : [status, limit],
    );
    return result.rows.map(mapRow);
  }

  public async get(id: string): Promise<TaskRow | null> {
    const result = await this.database.query<TaskDatabaseRow>(
      `SELECT ${TASK_COLUMNS} FROM tasks WHERE id=$1`,
      [id],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public async create(row: TaskRow): Promise<TaskRow> {
    const result = await this.database.query<TaskDatabaseRow>(
      `INSERT INTO tasks
         (id,title,description,status,archived_from_status,priority,due_at,recurrence,parent_id,
          recurrence_source_id,completed_at,version,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING ${TASK_COLUMNS}`,
      [
        row.id,
        row.title,
        row.description,
        row.status,
        row.archivedFromStatus,
        row.priority,
        row.dueAt,
        row.recurrence,
        row.parentId,
        row.recurrenceSourceId,
        row.completedAt,
        row.version,
        row.createdAt,
        row.updatedAt,
      ],
    );
    return mapRow(result.rows[0]!);
  }

  public async update(row: TaskRow, version: number): Promise<TaskRow | null> {
    const result = await this.database.query<TaskDatabaseRow>(
      `UPDATE tasks SET title=$2,description=$3,status=$4,archived_from_status=NULL,priority=$5,
         due_at=$6,recurrence=$7,parent_id=$8,completed_at=$9,version=version+1,updated_at=$10
       WHERE id=$1 AND version=$11 AND status<>'archived' RETURNING ${TASK_COLUMNS}`,
      [
        row.id,
        row.title,
        row.description,
        row.status,
        row.priority,
        row.dueAt,
        row.recurrence,
        row.parentId,
        row.completedAt,
        row.updatedAt,
        version,
      ],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public async complete(
    current: TaskRow,
    expectedVersion: number,
    next: TaskRow | undefined,
  ): Promise<{ completed: TaskRow; next?: TaskRow } | null> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const completed = await client.query<TaskDatabaseRow>(
        `UPDATE tasks SET status='completed',completed_at=$2,version=version+1,updated_at=$2
         WHERE id=$1 AND version=$3 AND status IN ('todo','in-progress') RETURNING ${TASK_COLUMNS}`,
        [current.id, current.updatedAt, expectedVersion],
      );
      if (!completed.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      let createdNext: TaskRow | undefined;
      if (next) {
        const result = await client.query<TaskDatabaseRow>(
          `INSERT INTO tasks
             (id,title,description,status,archived_from_status,priority,due_at,recurrence,parent_id,
              recurrence_source_id,completed_at,version,created_at,updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           RETURNING ${TASK_COLUMNS}`,
          [
            next.id,
            next.title,
            next.description,
            next.status,
            next.archivedFromStatus,
            next.priority,
            next.dueAt,
            next.recurrence,
            next.parentId,
            next.recurrenceSourceId,
            next.completedAt,
            next.version,
            next.createdAt,
            next.updatedAt,
          ],
        );
        createdNext = mapRow(result.rows[0]!);
      }
      await client.query('COMMIT');
      return {
        completed: mapRow(completed.rows[0]),
        ...(createdNext ? { next: createdNext } : {}),
      };
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  public async archive(id: string, version: number, now: Date): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE tasks SET archived_from_status=status,status='archived',version=version+1,updated_at=$3
       WHERE id=$1 AND version=$2 AND status<>'archived'`,
      [id, version, now],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async restore(id: string, version: number, now: Date): Promise<TaskRow | null> {
    const result = await this.database.query<TaskDatabaseRow>(
      `UPDATE tasks SET status=archived_from_status,archived_from_status=NULL,
         version=version+1,updated_at=$3
       WHERE id=$1 AND version=$2 AND status='archived' RETURNING ${TASK_COLUMNS}`,
      [id, version, now],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public async deletePermanently(id: string, version: number): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM tasks WHERE id=$1 AND version=$2 AND status='archived'`,
      [id, version],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async upcoming(from: Date, to: Date, limit: number): Promise<TaskRow[]> {
    const result = await this.database.query<TaskDatabaseRow>(
      `SELECT ${TASK_COLUMNS} FROM tasks WHERE status IN ('todo','in-progress')
       AND due_at BETWEEN $1 AND $2 ORDER BY due_at ASC,id ASC LIMIT $3`,
      [from, to, limit],
    );
    return result.rows.map(mapRow);
  }

  public async recent(limit: number): Promise<TaskRow[]> {
    const result = await this.database.query<TaskDatabaseRow>(
      `SELECT ${TASK_COLUMNS} FROM tasks WHERE status<>'archived'
       ORDER BY updated_at DESC,id ASC LIMIT $1`,
      [limit],
    );
    return result.rows.map(mapRow);
  }

  public async search(query: string, limit: number): Promise<TaskRow[]> {
    const pattern = `%${query.toLocaleLowerCase('zh-CN')}%`;
    const result = await this.database.query<TaskDatabaseRow>(
      `SELECT ${TASK_COLUMNS} FROM tasks WHERE status<>'archived'
       AND (LOWER(title) LIKE $1 OR LOWER(description) LIKE $1)
       ORDER BY updated_at DESC,id ASC LIMIT $2`,
      [pattern, limit],
    );
    return result.rows.map(mapRow);
  }
}
