import type {
  GoalKeyResult,
  GoalMeasurement,
  GoalMetricDirection,
  GoalPeriodType,
  GoalStatus,
} from '@workspace/client-sdk';
import type { Database, DatabaseClient } from '../../platform/database/types.js';

export interface GoalRow {
  id: string;
  title: string;
  description: string;
  periodType: GoalPeriodType;
  periodLabel: string;
  startDate: string;
  endDate: string;
  status: GoalStatus;
  archivedFromStatus: Exclude<GoalStatus, 'archived'> | null;
  startValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  metricUnit: string;
  metricDirection: GoalMetricDirection | null;
  keyResults: GoalKeyResult[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

interface GoalDatabaseRow {
  id: string;
  title: string;
  description: string;
  period_type: GoalPeriodType;
  period_label: string;
  start_date: string | Date;
  end_date: string | Date;
  status: GoalStatus;
  archived_from_status: Exclude<GoalStatus, 'archived'> | null;
  start_value: string | number | null;
  target_value: string | number | null;
  current_value: string | number | null;
  metric_unit: string;
  metric_direction: GoalMetricDirection | null;
  key_results: GoalKeyResult[] | string;
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface GoalMeasurementDatabaseRow {
  id: string;
  value: string | number;
  note: string;
  recorded_at: Date;
}

const GOAL_COLUMNS = `id, title, description, period_type, period_label, start_date, end_date,
  status, archived_from_status, start_value, target_value, current_value, metric_unit,
  metric_direction, key_results, version, created_at, updated_at`;

function numeric(value: string | number | null): number | null {
  return value === null ? null : Number(value);
}

function dateOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function mapRow(row: GoalDatabaseRow): GoalRow {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    periodType: row.period_type,
    periodLabel: row.period_label,
    startDate: dateOnly(row.start_date),
    endDate: dateOnly(row.end_date),
    status: row.status,
    archivedFromStatus: row.archived_from_status,
    startValue: numeric(row.start_value),
    targetValue: numeric(row.target_value),
    currentValue: numeric(row.current_value),
    metricUnit: row.metric_unit,
    metricDirection: row.metric_direction,
    keyResults:
      typeof row.key_results === 'string'
        ? (JSON.parse(row.key_results) as GoalKeyResult[])
        : row.key_results,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMeasurement(row: GoalMeasurementDatabaseRow): GoalMeasurement {
  return {
    id: row.id,
    value: Number(row.value),
    note: row.note,
    recordedAt: row.recorded_at.toISOString(),
  };
}

async function rollback(client: DatabaseClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Preserve the original transaction error.
  }
}

export class GoalRepository {
  public constructor(private readonly database: Database) {}

  public async list(status: GoalStatus, limit: number): Promise<GoalRow[]> {
    const result = await this.database.query<GoalDatabaseRow>(
      `SELECT ${GOAL_COLUMNS} FROM goals
       WHERE status=$1 ORDER BY end_date ASC, updated_at DESC, id ASC LIMIT $2`,
      [status, limit],
    );
    return result.rows.map(mapRow);
  }

  public async get(id: string): Promise<GoalRow | null> {
    const result = await this.database.query<GoalDatabaseRow>(
      `SELECT ${GOAL_COLUMNS} FROM goals WHERE id=$1`,
      [id],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public async measurements(goalId: string): Promise<GoalMeasurement[]> {
    const result = await this.database.query<GoalMeasurementDatabaseRow>(
      `SELECT id, value, note, recorded_at FROM goal_measurements
       WHERE goal_id=$1 ORDER BY recorded_at ASC, id ASC`,
      [goalId],
    );
    return result.rows.map(mapMeasurement);
  }

  public async create(
    row: GoalRow,
    initialMeasurement?: { id: string; value: number; recordedAt: Date },
  ): Promise<GoalRow> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<GoalDatabaseRow>(
        `INSERT INTO goals
           (id,title,description,period_type,period_label,start_date,end_date,status,
            archived_from_status,start_value,target_value,current_value,metric_unit,
            metric_direction,key_results,version,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18)
         RETURNING ${GOAL_COLUMNS}`,
        [
          row.id,
          row.title,
          row.description,
          row.periodType,
          row.periodLabel,
          row.startDate,
          row.endDate,
          row.status,
          row.archivedFromStatus,
          row.startValue,
          row.targetValue,
          row.currentValue,
          row.metricUnit,
          row.metricDirection,
          JSON.stringify(row.keyResults),
          row.version,
          row.createdAt,
          row.updatedAt,
        ],
      );
      if (initialMeasurement) {
        await client.query(
          `INSERT INTO goal_measurements (id,goal_id,value,note,recorded_at,created_at)
           VALUES ($1,$2,$3,'初始值',$4,$4)`,
          [initialMeasurement.id, row.id, initialMeasurement.value, initialMeasurement.recordedAt],
        );
      }
      await client.query('COMMIT');
      return mapRow(result.rows[0]!);
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  public async update(row: GoalRow, expectedVersion: number): Promise<GoalRow | null> {
    const result = await this.database.query<GoalDatabaseRow>(
      `UPDATE goals SET title=$2,description=$3,period_type=$4,period_label=$5,start_date=$6,
         end_date=$7,status=$8,archived_from_status=NULL,start_value=$9,target_value=$10,
         current_value=$11,metric_unit=$12,metric_direction=$13,key_results=$14::jsonb,
         version=version+1,updated_at=$15
       WHERE id=$1 AND version=$16 AND status<>'archived' RETURNING ${GOAL_COLUMNS}`,
      [
        row.id,
        row.title,
        row.description,
        row.periodType,
        row.periodLabel,
        row.startDate,
        row.endDate,
        row.status,
        row.startValue,
        row.targetValue,
        row.currentValue,
        row.metricUnit,
        row.metricDirection,
        JSON.stringify(row.keyResults),
        row.updatedAt,
        expectedVersion,
      ],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public async addMeasurement(input: {
    goalId: string;
    id: string;
    value: number;
    note: string;
    recordedAt: Date;
    expectedVersion: number;
    now: Date;
  }): Promise<GoalRow | null> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<GoalDatabaseRow>(
        `UPDATE goals SET current_value=$2,version=version+1,updated_at=$3
         WHERE id=$1 AND version=$4 AND status<>'archived' AND metric_direction IS NOT NULL
         RETURNING ${GOAL_COLUMNS}`,
        [input.goalId, input.value, input.now, input.expectedVersion],
      );
      if (!result.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query(
        `INSERT INTO goal_measurements (id,goal_id,value,note,recorded_at,created_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [input.id, input.goalId, input.value, input.note, input.recordedAt, input.now],
      );
      await client.query('COMMIT');
      return mapRow(result.rows[0]);
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  public async archive(id: string, version: number, now: Date): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE goals SET archived_from_status=status,status='archived',version=version+1,updated_at=$3
       WHERE id=$1 AND version=$2 AND status<>'archived'`,
      [id, version, now],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async restore(id: string, version: number, now: Date): Promise<GoalRow | null> {
    const result = await this.database.query<GoalDatabaseRow>(
      `UPDATE goals SET status=archived_from_status,archived_from_status=NULL,
         version=version+1,updated_at=$3
       WHERE id=$1 AND version=$2 AND status='archived' RETURNING ${GOAL_COLUMNS}`,
      [id, version, now],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public async deletePermanently(id: string, version: number): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM goals WHERE id=$1 AND version=$2 AND status='archived'`,
      [id, version],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async recent(limit: number): Promise<GoalRow[]> {
    const result = await this.database.query<GoalDatabaseRow>(
      `SELECT ${GOAL_COLUMNS} FROM goals WHERE status<>'archived'
       ORDER BY updated_at DESC,id ASC LIMIT $1`,
      [limit],
    );
    return result.rows.map(mapRow);
  }

  public async search(query: string, limit: number): Promise<GoalRow[]> {
    const pattern = `%${query.toLocaleLowerCase('zh-CN')}%`;
    const result = await this.database.query<GoalDatabaseRow>(
      `SELECT ${GOAL_COLUMNS} FROM goals WHERE status<>'archived'
       AND (LOWER(title) LIKE $1 OR LOWER(description) LIKE $1 OR LOWER(period_label) LIKE $1)
       ORDER BY updated_at DESC,id ASC LIMIT $2`,
      [pattern, limit],
    );
    return result.rows.map(mapRow);
  }
}
