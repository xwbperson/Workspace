import type {
  TimetableAdjustment,
  TimetableAdjustmentType,
  TimetableColor,
  TimetableCourse,
  TimetableEntityStatus,
  TimetableMeeting,
  TimetableSemester,
  TimetableTimeBlock,
} from '@workspace/client-sdk';
import type { Database, DatabaseClient } from '../../platform/database/types.js';

export interface TimetableSemesterRow extends Omit<
  TimetableSemester,
  'timeBlocks' | 'createdAt' | 'updatedAt'
> {
  createdAt: Date;
  updatedAt: Date;
}

export interface TimetableCourseRow extends Omit<
  TimetableCourse,
  'meetings' | 'createdAt' | 'updatedAt'
> {
  createdAt: Date;
  updatedAt: Date;
}

export interface TimetableAdjustmentRow extends Omit<
  TimetableAdjustment,
  'createdAt' | 'updatedAt'
> {
  createdAt: Date;
  updatedAt: Date;
}

interface SemesterDatabaseRow {
  id: string;
  name: string;
  short_name: string;
  first_week_monday: string | Date;
  total_weeks: number;
  is_current: boolean;
  show_weekend: boolean;
  status: TimetableEntityStatus;
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface TimeBlockDatabaseRow {
  id: string;
  semester_id: string;
  label: string;
  source_label: string;
  start_time: string;
  end_time: string;
  position: number;
  version: number;
}

interface CourseDatabaseRow {
  id: string;
  semester_id: string;
  name: string;
  short_name: string;
  instructors: string[] | string;
  color: TimetableColor;
  notes: string;
  status: TimetableEntityStatus;
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface MeetingDatabaseRow {
  id: string;
  course_id: string;
  time_block_id: string;
  weekday: number;
  room: string;
  instructor_override: string[] | string;
  position: number;
  version: number;
}

interface WeekDatabaseRow {
  meeting_id: string;
  week_number: number;
}

interface AdjustmentDatabaseRow {
  id: string;
  course_id: string;
  meeting_id: string;
  original_date: string | Date;
  type: TimetableAdjustmentType;
  new_date: string | Date | null;
  new_time_block_id: string | null;
  room: string | null;
  instructors: string[] | string | null;
  note: string;
  version: number;
  created_at: Date;
  updated_at: Date;
}

const SEMESTER_COLUMNS = `id,name,short_name,first_week_monday,total_weeks,is_current,
  show_weekend,status,version,created_at,updated_at`;
const COURSE_COLUMNS = `id,semester_id,name,short_name,instructors,color,notes,status,
  version,created_at,updated_at`;
const MEETING_COLUMNS = `id,course_id,time_block_id,weekday,room,instructor_override,
  position,version`;
const ADJUSTMENT_COLUMNS = `id,course_id,meeting_id,original_date,type,new_date,
  new_time_block_id,room,instructors,note,version,created_at,updated_at`;

function dateOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function timeOnly(value: string): string {
  return value.slice(0, 5);
}

function jsonArray(value: string[] | string | null): string[] {
  if (value === null) return [];
  return typeof value === 'string' ? (JSON.parse(value) as string[]) : value;
}

function mapSemester(row: SemesterDatabaseRow): TimetableSemesterRow {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    firstWeekMonday: dateOnly(row.first_week_monday),
    totalWeeks: row.total_weeks,
    isCurrent: row.is_current,
    showWeekend: row.show_weekend,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTimeBlock(row: TimeBlockDatabaseRow): TimetableTimeBlock {
  return {
    id: row.id,
    semesterId: row.semester_id,
    label: row.label,
    sourceLabel: row.source_label,
    startTime: timeOnly(row.start_time),
    endTime: timeOnly(row.end_time),
    position: row.position,
    version: row.version,
  };
}

function mapCourse(row: CourseDatabaseRow): TimetableCourseRow {
  return {
    id: row.id,
    semesterId: row.semester_id,
    name: row.name,
    shortName: row.short_name,
    instructors: jsonArray(row.instructors),
    color: row.color,
    notes: row.notes,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMeeting(row: MeetingDatabaseRow, weeks: readonly number[]): TimetableMeeting {
  return {
    id: row.id,
    courseId: row.course_id,
    timeBlockId: row.time_block_id,
    weekday: row.weekday,
    room: row.room,
    instructorOverride: jsonArray(row.instructor_override),
    weekNumbers: [...weeks],
    position: row.position,
    version: row.version,
  };
}

function mapAdjustment(row: AdjustmentDatabaseRow): TimetableAdjustmentRow {
  return {
    id: row.id,
    courseId: row.course_id,
    meetingId: row.meeting_id,
    originalDate: dateOnly(row.original_date),
    type: row.type,
    ...(row.new_date ? { newDate: dateOnly(row.new_date) } : {}),
    ...(row.new_time_block_id ? { newTimeBlockId: row.new_time_block_id } : {}),
    ...(row.room !== null ? { room: row.room } : {}),
    ...(row.instructors !== null ? { instructors: jsonArray(row.instructors) } : {}),
    note: row.note,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSemester(
  row: TimetableSemesterRow,
  timeBlocks: TimetableTimeBlock[],
): TimetableSemester {
  return {
    ...row,
    timeBlocks,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toCourse(row: TimetableCourseRow, meetings: TimetableMeeting[]): TimetableCourse {
  return {
    ...row,
    meetings,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAdjustment(row: TimetableAdjustmentRow): TimetableAdjustment {
  return {
    ...row,
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

export class TimetableRepository {
  public constructor(private readonly database: Database) {}

  public async listSemesters(status: TimetableEntityStatus): Promise<TimetableSemester[]> {
    const result = await this.database.query<SemesterDatabaseRow>(
      `SELECT ${SEMESTER_COLUMNS} FROM timetable_semesters WHERE status=$1
       ORDER BY is_current DESC,first_week_monday DESC,id ASC`,
      [status],
    );
    return Promise.all(result.rows.map(async (row) => this.hydrateSemester(mapSemester(row))));
  }

  public async getSemester(id: string): Promise<TimetableSemester | null> {
    const result = await this.database.query<SemesterDatabaseRow>(
      `SELECT ${SEMESTER_COLUMNS} FROM timetable_semesters WHERE id=$1`,
      [id],
    );
    return result.rows[0] ? this.hydrateSemester(mapSemester(result.rows[0])) : null;
  }

  public async getCurrentSemester(): Promise<TimetableSemester | null> {
    const result = await this.database.query<SemesterDatabaseRow>(
      `SELECT ${SEMESTER_COLUMNS} FROM timetable_semesters
       WHERE status='active' AND is_current=true ORDER BY updated_at DESC LIMIT 1`,
    );
    return result.rows[0] ? this.hydrateSemester(mapSemester(result.rows[0])) : null;
  }

  private async hydrateSemester(row: TimetableSemesterRow): Promise<TimetableSemester> {
    const blocks = await this.database.query<TimeBlockDatabaseRow>(
      `SELECT id,semester_id,label,source_label,start_time,end_time,position,version
       FROM timetable_time_blocks WHERE semester_id=$1 ORDER BY position ASC`,
      [row.id],
    );
    return toSemester(row, blocks.rows.map(mapTimeBlock));
  }

  public async createSemester(input: {
    row: TimetableSemesterRow;
    blocks: TimetableTimeBlock[];
  }): Promise<TimetableSemester> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      if (input.row.isCurrent) {
        await client.query(
          `UPDATE timetable_semesters SET is_current=false,version=version+1,updated_at=$1
           WHERE status='active' AND is_current=true`,
          [input.row.updatedAt],
        );
      }
      await client.query(
        `INSERT INTO timetable_semesters
           (id,name,short_name,first_week_monday,total_weeks,is_current,show_weekend,status,
            version,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          input.row.id,
          input.row.name,
          input.row.shortName,
          input.row.firstWeekMonday,
          input.row.totalWeeks,
          input.row.isCurrent,
          input.row.showWeekend,
          input.row.status,
          input.row.version,
          input.row.createdAt,
          input.row.updatedAt,
        ],
      );
      for (const block of input.blocks) {
        await client.query(
          `INSERT INTO timetable_time_blocks
             (id,semester_id,label,source_label,start_time,end_time,position,version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            block.id,
            block.semesterId,
            block.label,
            block.sourceLabel,
            block.startTime,
            block.endTime,
            block.position,
            block.version,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
    return (await this.getSemester(input.row.id))!;
  }

  public async updateSemester(
    row: TimetableSemesterRow,
    expectedVersion: number,
  ): Promise<TimetableSemester | null> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      if (row.isCurrent) {
        await client.query(
          `UPDATE timetable_semesters SET is_current=false,version=version+1,updated_at=$1
           WHERE id<>$2 AND status='active' AND is_current=true`,
          [row.updatedAt, row.id],
        );
      }
      const result = await client.query<SemesterDatabaseRow>(
        `UPDATE timetable_semesters SET name=$2,short_name=$3,first_week_monday=$4,
           total_weeks=$5,is_current=$6,show_weekend=$7,version=version+1,updated_at=$8
         WHERE id=$1 AND version=$9 AND status='active' RETURNING ${SEMESTER_COLUMNS}`,
        [
          row.id,
          row.name,
          row.shortName,
          row.firstWeekMonday,
          row.totalWeeks,
          row.isCurrent,
          row.showWeekend,
          row.updatedAt,
          expectedVersion,
        ],
      );
      if (!result.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query('COMMIT');
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
    return this.getSemester(row.id);
  }

  public async updateTimeBlocks(
    semesterId: string,
    blocks: TimetableTimeBlock[],
    expectedSemesterVersion: number,
    now: Date,
  ): Promise<TimetableSemester | null> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const semester = await client.query(
        `UPDATE timetable_semesters SET version=version+1,updated_at=$3
         WHERE id=$1 AND version=$2 AND status='active'`,
        [semesterId, expectedSemesterVersion, now],
      );
      if ((semester.rowCount ?? 0) !== 1) {
        await client.query('ROLLBACK');
        return null;
      }
      for (const block of blocks) {
        const result = await client.query(
          `UPDATE timetable_time_blocks SET label=$3,source_label=$4,start_time=$5,end_time=$6,
             position=$7,version=version+1
           WHERE id=$1 AND semester_id=$2 AND version=$8`,
          [
            block.id,
            semesterId,
            block.label,
            block.sourceLabel,
            block.startTime,
            block.endTime,
            block.position,
            block.version,
          ],
        );
        if ((result.rowCount ?? 0) !== 1) {
          await client.query('ROLLBACK');
          return null;
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
    return this.getSemester(semesterId);
  }

  public async archiveSemester(id: string, version: number, now: Date): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE timetable_semesters SET status='archived',is_current=false,
         version=version+1,updated_at=$3
       WHERE id=$1 AND version=$2 AND status='active'`,
      [id, version, now],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async restoreSemester(
    id: string,
    version: number,
    now: Date,
  ): Promise<TimetableSemester | null> {
    const result = await this.database.query(
      `UPDATE timetable_semesters SET status='active',version=version+1,updated_at=$3
       WHERE id=$1 AND version=$2 AND status='archived'`,
      [id, version, now],
    );
    return (result.rowCount ?? 0) === 1 ? this.getSemester(id) : null;
  }

  public async deleteSemester(id: string, version: number): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM timetable_semesters WHERE id=$1 AND version=$2 AND status='archived'`,
      [id, version],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async listCourses(
    semesterId: string,
    status: TimetableEntityStatus,
  ): Promise<TimetableCourse[]> {
    const result = await this.database.query<CourseDatabaseRow>(
      `SELECT ${COURSE_COLUMNS} FROM timetable_courses
       WHERE semester_id=$1 AND status=$2 ORDER BY name ASC,updated_at DESC,id ASC`,
      [semesterId, status],
    );
    return Promise.all(result.rows.map(async (row) => this.hydrateCourse(mapCourse(row))));
  }

  public async getCourse(id: string): Promise<TimetableCourse | null> {
    const result = await this.database.query<CourseDatabaseRow>(
      `SELECT ${COURSE_COLUMNS} FROM timetable_courses WHERE id=$1`,
      [id],
    );
    return result.rows[0] ? this.hydrateCourse(mapCourse(result.rows[0])) : null;
  }

  private async hydrateCourse(row: TimetableCourseRow): Promise<TimetableCourse> {
    const [meetings, weeks] = await Promise.all([
      this.database.query<MeetingDatabaseRow>(
        `SELECT ${MEETING_COLUMNS} FROM timetable_meetings
         WHERE course_id=$1 ORDER BY position ASC,id ASC`,
        [row.id],
      ),
      this.database.query<WeekDatabaseRow>(
        `SELECT w.meeting_id,w.week_number FROM timetable_meeting_weeks w
         JOIN timetable_meetings m ON m.id=w.meeting_id
         WHERE m.course_id=$1 ORDER BY w.week_number ASC`,
        [row.id],
      ),
    ]);
    const weeksByMeeting = new Map<string, number[]>();
    for (const week of weeks.rows) {
      weeksByMeeting.set(week.meeting_id, [
        ...(weeksByMeeting.get(week.meeting_id) ?? []),
        week.week_number,
      ]);
    }
    return toCourse(
      row,
      meetings.rows.map((meeting) => mapMeeting(meeting, weeksByMeeting.get(meeting.id) ?? [])),
    );
  }

  public async createCourse(input: {
    row: TimetableCourseRow;
    meetings: TimetableMeeting[];
  }): Promise<TimetableCourse> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO timetable_courses
           (id,semester_id,name,short_name,instructors,color,notes,status,version,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11)`,
        [
          input.row.id,
          input.row.semesterId,
          input.row.name,
          input.row.shortName,
          JSON.stringify(input.row.instructors),
          input.row.color,
          input.row.notes,
          input.row.status,
          input.row.version,
          input.row.createdAt,
          input.row.updatedAt,
        ],
      );
      await this.insertMeetings(client, input.meetings);
      await client.query('COMMIT');
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
    return (await this.getCourse(input.row.id))!;
  }

  private async insertMeetings(
    client: DatabaseClient,
    meetings: readonly TimetableMeeting[],
  ): Promise<void> {
    for (const meeting of meetings) {
      await client.query(
        `INSERT INTO timetable_meetings
           (id,course_id,time_block_id,weekday,room,instructor_override,position,version)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
        [
          meeting.id,
          meeting.courseId,
          meeting.timeBlockId,
          meeting.weekday,
          meeting.room,
          JSON.stringify(meeting.instructorOverride),
          meeting.position,
          meeting.version,
        ],
      );
      for (const week of meeting.weekNumbers) {
        await client.query(
          `INSERT INTO timetable_meeting_weeks (meeting_id,week_number) VALUES ($1,$2)`,
          [meeting.id, week],
        );
      }
    }
  }

  public async updateCourse(
    row: TimetableCourseRow,
    meetings: TimetableMeeting[],
    expectedVersion: number,
  ): Promise<TimetableCourse | null> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE timetable_courses SET name=$2,short_name=$3,instructors=$4::jsonb,color=$5,
           notes=$6,version=version+1,updated_at=$7
         WHERE id=$1 AND version=$8 AND status='active'`,
        [
          row.id,
          row.name,
          row.shortName,
          JSON.stringify(row.instructors),
          row.color,
          row.notes,
          row.updatedAt,
          expectedVersion,
        ],
      );
      if ((updated.rowCount ?? 0) !== 1) {
        await client.query('ROLLBACK');
        return null;
      }
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM timetable_meetings WHERE course_id=$1`,
        [row.id],
      );
      const incomingIds = new Set(meetings.map((meeting) => meeting.id));
      for (const current of existing.rows) {
        if (!incomingIds.has(current.id)) {
          await client.query(`DELETE FROM timetable_meetings WHERE id=$1 AND course_id=$2`, [
            current.id,
            row.id,
          ]);
        }
      }
      const existingIds = new Set(existing.rows.map((meeting) => meeting.id));
      for (const meeting of meetings) {
        if (existingIds.has(meeting.id)) {
          await client.query(
            `UPDATE timetable_meetings SET time_block_id=$3,weekday=$4,room=$5,
               instructor_override=$6::jsonb,position=$7,version=version+1
             WHERE id=$1 AND course_id=$2`,
            [
              meeting.id,
              row.id,
              meeting.timeBlockId,
              meeting.weekday,
              meeting.room,
              JSON.stringify(meeting.instructorOverride),
              meeting.position,
            ],
          );
          await client.query(`DELETE FROM timetable_meeting_weeks WHERE meeting_id=$1`, [
            meeting.id,
          ]);
          for (const week of meeting.weekNumbers) {
            await client.query(
              `INSERT INTO timetable_meeting_weeks (meeting_id,week_number) VALUES ($1,$2)`,
              [meeting.id, week],
            );
          }
        } else {
          await this.insertMeetings(client, [meeting]);
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
    return this.getCourse(row.id);
  }

  public async archiveCourse(id: string, version: number, now: Date): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE timetable_courses SET status='archived',version=version+1,updated_at=$3
       WHERE id=$1 AND version=$2 AND status='active'`,
      [id, version, now],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async restoreCourse(
    id: string,
    version: number,
    now: Date,
  ): Promise<TimetableCourse | null> {
    const result = await this.database.query(
      `UPDATE timetable_courses SET status='active',version=version+1,updated_at=$3
       WHERE id=$1 AND version=$2 AND status='archived'`,
      [id, version, now],
    );
    return (result.rowCount ?? 0) === 1 ? this.getCourse(id) : null;
  }

  public async deleteCourse(id: string, version: number): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM timetable_courses WHERE id=$1 AND version=$2 AND status='archived'`,
      [id, version],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async listAdjustments(semesterId: string): Promise<TimetableAdjustment[]> {
    const result = await this.database.query<AdjustmentDatabaseRow>(
      `SELECT a.id,a.course_id,a.meeting_id,a.original_date,a.type,a.new_date,
         a.new_time_block_id,a.room,a.instructors,a.note,a.version,a.created_at,a.updated_at
       FROM timetable_adjustments a
       JOIN timetable_courses c ON c.id=a.course_id
       WHERE c.semester_id=$1 ORDER BY a.original_date ASC,a.id ASC`,
      [semesterId],
    );
    return result.rows.map((row) => toAdjustment(mapAdjustment(row)));
  }

  public async getAdjustment(id: string): Promise<TimetableAdjustment | null> {
    const result = await this.database.query<AdjustmentDatabaseRow>(
      `SELECT ${ADJUSTMENT_COLUMNS} FROM timetable_adjustments WHERE id=$1`,
      [id],
    );
    return result.rows[0] ? toAdjustment(mapAdjustment(result.rows[0])) : null;
  }

  public async createAdjustment(row: TimetableAdjustmentRow): Promise<TimetableAdjustment> {
    const result = await this.database.query<AdjustmentDatabaseRow>(
      `INSERT INTO timetable_adjustments
         (id,course_id,meeting_id,original_date,type,new_date,new_time_block_id,room,instructors,
          note,version,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13)
       RETURNING ${ADJUSTMENT_COLUMNS}`,
      [
        row.id,
        row.courseId,
        row.meetingId,
        row.originalDate,
        row.type,
        row.newDate ?? null,
        row.newTimeBlockId ?? null,
        row.room ?? null,
        row.instructors ? JSON.stringify(row.instructors) : null,
        row.note,
        row.version,
        row.createdAt,
        row.updatedAt,
      ],
    );
    return toAdjustment(mapAdjustment(result.rows[0]!));
  }

  public async updateAdjustment(
    row: TimetableAdjustmentRow,
    expectedVersion: number,
  ): Promise<TimetableAdjustment | null> {
    const result = await this.database.query<AdjustmentDatabaseRow>(
      `UPDATE timetable_adjustments SET type=$2,new_date=$3,new_time_block_id=$4,room=$5,
         instructors=$6::jsonb,note=$7,version=version+1,updated_at=$8
       WHERE id=$1 AND version=$9 RETURNING ${ADJUSTMENT_COLUMNS}`,
      [
        row.id,
        row.type,
        row.newDate ?? null,
        row.newTimeBlockId ?? null,
        row.room ?? null,
        row.instructors ? JSON.stringify(row.instructors) : null,
        row.note,
        row.updatedAt,
        expectedVersion,
      ],
    );
    return result.rows[0] ? toAdjustment(mapAdjustment(result.rows[0])) : null;
  }

  public async deleteAdjustment(id: string, version: number): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM timetable_adjustments WHERE id=$1 AND version=$2`,
      [id, version],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async searchCourses(query: string, limit: number): Promise<TimetableCourse[]> {
    const pattern = `%${query.toLocaleLowerCase('zh-CN')}%`;
    const result = await this.database.query<CourseDatabaseRow>(
      `SELECT DISTINCT ${COURSE_COLUMNS.split(',')
        .map((column) => `c.${column.trim()}`)
        .join(',')}
       FROM timetable_courses c
       LEFT JOIN timetable_meetings m ON m.course_id=c.id
       WHERE c.status='active' AND (
         LOWER(c.name) LIKE $1 OR LOWER(c.short_name) LIKE $1 OR LOWER(c.notes) LIKE $1
         OR LOWER(m.room) LIKE $1 OR LOWER(c.instructors::text) LIKE $1
       ) ORDER BY c.updated_at DESC,c.id ASC LIMIT $2`,
      [pattern, limit],
    );
    return Promise.all(result.rows.map(async (row) => this.hydrateCourse(mapCourse(row))));
  }

  public async recentCourses(limit: number): Promise<TimetableCourse[]> {
    const result = await this.database.query<CourseDatabaseRow>(
      `SELECT ${COURSE_COLUMNS} FROM timetable_courses WHERE status='active'
       ORDER BY updated_at DESC,id ASC LIMIT $1`,
      [limit],
    );
    return Promise.all(result.rows.map(async (row) => this.hydrateCourse(mapCourse(row))));
  }
}
