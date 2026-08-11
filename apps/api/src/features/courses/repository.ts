import type { Database } from '../../platform/database/types.js';

export type AssignmentStatus = 'pending' | 'in-progress' | 'completed' | 'abandoned';

export interface CourseRow {
  id: string;
  name: string;
  instructor: string;
  courseCode: string;
  credits: number;
  totalHours: number;
  objectives: string;
  description: string;
  schedule: string;
  syllabusFileId: string | null;
  syllabusOriginalName: string | null;
  syllabusMimeType: string | null;
  syllabusSize: number | null;
  archived: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClassRecordRow {
  id: string;
  courseId: string;
  occurredAt: Date;
  content: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignmentRow {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueAt: Date | null;
  status: AssignmentStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaterialGroupRow {
  id: string;
  courseId: string;
  name: string;
  position: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaterialRow {
  id: string;
  courseId: string;
  groupId: string | null;
  fileId: string;
  label: string;
  position: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  originalName: string;
  mimeType: string;
  size: number;
}

interface CourseDbRow {
  id: string;
  name: string;
  instructor: string;
  course_code: string;
  credits: string | number;
  total_hours: number;
  objectives: string;
  description: string;
  schedule: string;
  syllabus_file_id: string | null;
  syllabus_original_name: string | null;
  syllabus_mime_type: string | null;
  syllabus_size: string | number | null;
  archived: boolean;
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface ClassRecordDbRow {
  id: string;
  course_id: string;
  occurred_at: Date;
  content: string;
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface AssignmentDbRow {
  id: string;
  course_id: string;
  title: string;
  description: string;
  due_at: Date | null;
  status: AssignmentStatus;
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface MaterialGroupDbRow {
  id: string;
  course_id: string;
  name: string;
  position: number;
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface MaterialDbRow {
  id: string;
  course_id: string;
  group_id: string | null;
  file_id: string;
  label: string;
  position: number;
  version: number;
  created_at: Date;
  updated_at: Date;
  original_name: string;
  mime_type: string;
  size_bytes: string | number;
}

const COURSE_COLUMNS = `
  c.id, c.name, c.instructor, c.course_code, c.credits, c.total_hours,
  c.objectives, c.description, c.schedule, c.syllabus_file_id,
  f.original_name AS syllabus_original_name, f.mime_type AS syllabus_mime_type,
  f.size_bytes AS syllabus_size, c.archived, c.version, c.created_at, c.updated_at`;

function mapCourse(row: CourseDbRow): CourseRow {
  return {
    id: row.id,
    name: row.name,
    instructor: row.instructor,
    courseCode: row.course_code,
    credits: Number(row.credits),
    totalHours: row.total_hours,
    objectives: row.objectives,
    description: row.description,
    schedule: row.schedule,
    syllabusFileId: row.syllabus_file_id,
    syllabusOriginalName: row.syllabus_original_name,
    syllabusMimeType: row.syllabus_mime_type,
    syllabusSize: row.syllabus_size === null ? null : Number(row.syllabus_size),
    archived: row.archived,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapClassRecord(row: ClassRecordDbRow): ClassRecordRow {
  return {
    id: row.id,
    courseId: row.course_id,
    occurredAt: row.occurred_at,
    content: row.content,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssignment(row: AssignmentDbRow): AssignmentRow {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    description: row.description,
    dueAt: row.due_at,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGroup(row: MaterialGroupDbRow): MaterialGroupRow {
  return {
    id: row.id,
    courseId: row.course_id,
    name: row.name,
    position: row.position,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMaterial(row: MaterialDbRow): MaterialRow {
  return {
    id: row.id,
    courseId: row.course_id,
    groupId: row.group_id,
    fileId: row.file_id,
    label: row.label,
    position: row.position,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    originalName: row.original_name,
    mimeType: row.mime_type,
    size: Number(row.size_bytes),
  };
}

export class CourseRepository {
  public constructor(private readonly database: Database) {}

  public async list(archived: boolean, limit: number): Promise<CourseRow[]> {
    const result = await this.database.query<CourseDbRow>(
      `SELECT ${COURSE_COLUMNS}
       FROM courses c LEFT JOIN stored_files f ON f.id=c.syllabus_file_id
       WHERE c.archived=$1 ORDER BY c.updated_at DESC, c.name ASC LIMIT $2`,
      [archived, limit],
    );
    return result.rows.map(mapCourse);
  }

  public async get(id: string): Promise<CourseRow | null> {
    const result = await this.database.query<CourseDbRow>(
      `SELECT ${COURSE_COLUMNS}
       FROM courses c LEFT JOIN stored_files f ON f.id=c.syllabus_file_id WHERE c.id=$1`,
      [id],
    );
    return result.rows[0] ? mapCourse(result.rows[0]) : null;
  }

  public async create(row: CourseRow): Promise<CourseRow> {
    await this.database.query(
      `INSERT INTO courses
         (id, name, instructor, course_code, credits, total_hours, objectives, description,
          schedule, syllabus_file_id, archived, version, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        row.id,
        row.name,
        row.instructor,
        row.courseCode,
        row.credits,
        row.totalHours,
        row.objectives,
        row.description,
        row.schedule,
        row.syllabusFileId,
        row.archived,
        row.version,
        row.createdAt,
        row.updatedAt,
      ],
    );
    return (await this.get(row.id))!;
  }

  public async update(row: CourseRow, expectedVersion: number): Promise<CourseRow | null> {
    const result = await this.database.query<{ id: string }>(
      `UPDATE courses SET name=$2, instructor=$3, course_code=$4, credits=$5, total_hours=$6,
         objectives=$7, description=$8, schedule=$9, syllabus_file_id=$10,
         version=version+1, updated_at=$11
       WHERE id=$1 AND version=$12 AND archived=false RETURNING id`,
      [
        row.id,
        row.name,
        row.instructor,
        row.courseCode,
        row.credits,
        row.totalHours,
        row.objectives,
        row.description,
        row.schedule,
        row.syllabusFileId,
        row.updatedAt,
        expectedVersion,
      ],
    );
    return result.rows[0] ? this.get(row.id) : null;
  }

  public async setArchived(
    id: string,
    archived: boolean,
    expectedVersion: number,
    now: Date,
  ): Promise<CourseRow | null> {
    const result = await this.database.query<{ id: string }>(
      `UPDATE courses SET archived=$2, version=version+1, updated_at=$4
       WHERE id=$1 AND version=$3 AND archived<>$2 RETURNING id`,
      [id, archived, expectedVersion, now],
    );
    return result.rows[0] ? this.get(id) : null;
  }

  public async deletePermanently(id: string, expectedVersion: number): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM courses WHERE id=$1 AND version=$2 AND archived=true`,
      [id, expectedVersion],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async referenceBookIds(courseId: string): Promise<string[]> {
    const result = await this.database.query<{ book_id: string }>(
      `SELECT book_id FROM course_reference_books
       WHERE course_id=$1 ORDER BY position ASC, book_id ASC`,
      [courseId],
    );
    return result.rows.map((row) => row.book_id);
  }

  public async replaceReferenceBooks(courseId: string, bookIds: readonly string[]): Promise<void> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM course_reference_books WHERE course_id=$1`, [courseId]);
      for (const [position, bookId] of [...new Set(bookIds)].entries()) {
        await client.query(
          `INSERT INTO course_reference_books (course_id, book_id, position, created_at)
           VALUES ($1,$2,$3,now())`,
          [courseId, bookId, position],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async listClassRecords(courseId: string): Promise<ClassRecordRow[]> {
    const result = await this.database.query<ClassRecordDbRow>(
      `SELECT id, course_id, occurred_at, content, version, created_at, updated_at
       FROM course_class_records WHERE course_id=$1 ORDER BY occurred_at DESC, id ASC`,
      [courseId],
    );
    return result.rows.map(mapClassRecord);
  }

  public async createClassRecord(row: ClassRecordRow): Promise<ClassRecordRow> {
    const result = await this.database.query<ClassRecordDbRow>(
      `INSERT INTO course_class_records
         (id, course_id, occurred_at, content, version, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, course_id, occurred_at, content, version, created_at, updated_at`,
      [
        row.id,
        row.courseId,
        row.occurredAt,
        row.content,
        row.version,
        row.createdAt,
        row.updatedAt,
      ],
    );
    await this.touch(row.courseId, row.updatedAt);
    return mapClassRecord(result.rows[0]!);
  }

  public async updateClassRecord(
    row: ClassRecordRow,
    expectedVersion: number,
  ): Promise<ClassRecordRow | null> {
    const result = await this.database.query<ClassRecordDbRow>(
      `UPDATE course_class_records SET occurred_at=$3, content=$4, version=version+1, updated_at=$5
       WHERE course_id=$1 AND id=$2 AND version=$6
       RETURNING id, course_id, occurred_at, content, version, created_at, updated_at`,
      [row.courseId, row.id, row.occurredAt, row.content, row.updatedAt, expectedVersion],
    );
    if (!result.rows[0]) return null;
    await this.touch(row.courseId, row.updatedAt);
    return mapClassRecord(result.rows[0]);
  }

  public async deleteClassRecord(
    courseId: string,
    id: string,
    expectedVersion: number,
    now: Date,
  ): Promise<boolean> {
    return this.deleteChild('course_class_records', courseId, id, expectedVersion, now);
  }

  public async listAssignments(courseId: string): Promise<AssignmentRow[]> {
    const result = await this.database.query<AssignmentDbRow>(
      `SELECT id, course_id, title, description, due_at, status, version, created_at, updated_at
       FROM course_assignments WHERE course_id=$1
       ORDER BY CASE WHEN status='completed' THEN 1 ELSE 0 END, due_at ASC, created_at DESC`,
      [courseId],
    );
    return result.rows.map(mapAssignment);
  }

  public async createAssignment(row: AssignmentRow): Promise<AssignmentRow> {
    const result = await this.database.query<AssignmentDbRow>(
      `INSERT INTO course_assignments
         (id, course_id, title, description, due_at, status, version, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, course_id, title, description, due_at, status, version, created_at, updated_at`,
      [
        row.id,
        row.courseId,
        row.title,
        row.description,
        row.dueAt,
        row.status,
        row.version,
        row.createdAt,
        row.updatedAt,
      ],
    );
    await this.touch(row.courseId, row.updatedAt);
    return mapAssignment(result.rows[0]!);
  }

  public async updateAssignment(
    row: AssignmentRow,
    expectedVersion: number,
  ): Promise<AssignmentRow | null> {
    const result = await this.database.query<AssignmentDbRow>(
      `UPDATE course_assignments SET title=$3, description=$4, due_at=$5, status=$6,
         version=version+1, updated_at=$7
       WHERE course_id=$1 AND id=$2 AND version=$8
       RETURNING id, course_id, title, description, due_at, status, version, created_at, updated_at`,
      [
        row.courseId,
        row.id,
        row.title,
        row.description,
        row.dueAt,
        row.status,
        row.updatedAt,
        expectedVersion,
      ],
    );
    if (!result.rows[0]) return null;
    await this.touch(row.courseId, row.updatedAt);
    return mapAssignment(result.rows[0]);
  }

  public async getAssignment(courseId: string, id: string): Promise<AssignmentRow | null> {
    const result = await this.database.query<AssignmentDbRow>(
      `SELECT id, course_id, title, description, due_at, status, version, created_at, updated_at
       FROM course_assignments WHERE course_id=$1 AND id=$2`,
      [courseId, id],
    );
    return result.rows[0] ? mapAssignment(result.rows[0]) : null;
  }

  public async deleteAssignment(
    courseId: string,
    id: string,
    expectedVersion: number,
    now: Date,
  ): Promise<boolean> {
    return this.deleteChild('course_assignments', courseId, id, expectedVersion, now);
  }

  public async listMaterialGroups(courseId: string): Promise<MaterialGroupRow[]> {
    const result = await this.database.query<MaterialGroupDbRow>(
      `SELECT id, course_id, name, position, version, created_at, updated_at
       FROM course_material_groups WHERE course_id=$1 ORDER BY position ASC, name ASC`,
      [courseId],
    );
    return result.rows.map(mapGroup);
  }

  public async createMaterialGroup(row: MaterialGroupRow): Promise<MaterialGroupRow> {
    const result = await this.database.query<MaterialGroupDbRow>(
      `INSERT INTO course_material_groups
         (id, course_id, name, position, version, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, course_id, name, position, version, created_at, updated_at`,
      [row.id, row.courseId, row.name, row.position, row.version, row.createdAt, row.updatedAt],
    );
    await this.touch(row.courseId, row.updatedAt);
    return mapGroup(result.rows[0]!);
  }

  public async deleteMaterialGroup(
    courseId: string,
    id: string,
    expectedVersion: number,
    now: Date,
  ): Promise<boolean> {
    return this.deleteChild('course_material_groups', courseId, id, expectedVersion, now);
  }

  public async listMaterials(courseId: string): Promise<MaterialRow[]> {
    const result = await this.database.query<MaterialDbRow>(
      `SELECT m.id, m.course_id, m.group_id, m.file_id, m.label, m.position, m.version,
              m.created_at, m.updated_at, f.original_name, f.mime_type, f.size_bytes
       FROM course_materials m JOIN stored_files f ON f.id=m.file_id
       WHERE m.course_id=$1 ORDER BY m.position ASC, m.created_at DESC`,
      [courseId],
    );
    return result.rows.map(mapMaterial);
  }

  public async createMaterial(row: MaterialRow): Promise<MaterialRow> {
    await this.database.query(
      `INSERT INTO course_materials
         (id, course_id, group_id, file_id, label, position, version, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        row.id,
        row.courseId,
        row.groupId,
        row.fileId,
        row.label,
        row.position,
        row.version,
        row.createdAt,
        row.updatedAt,
      ],
    );
    await this.touch(row.courseId, row.updatedAt);
    return row;
  }

  public async deleteMaterial(
    courseId: string,
    id: string,
    expectedVersion: number,
    now: Date,
  ): Promise<boolean> {
    return this.deleteChild('course_materials', courseId, id, expectedVersion, now);
  }

  public async search(query: string, limit: number): Promise<CourseRow[]> {
    const pattern = `%${query.toLocaleLowerCase('zh-CN')}%`;
    const result = await this.database.query<CourseDbRow>(
      `SELECT ${COURSE_COLUMNS}
       FROM courses c LEFT JOIN stored_files f ON f.id=c.syllabus_file_id
       WHERE c.archived=false AND (
         LOWER(c.name) LIKE $1 OR LOWER(c.instructor) LIKE $1 OR LOWER(c.course_code) LIKE $1 OR
         LOWER(c.description) LIKE $1 OR LOWER(c.objectives) LIKE $1
       )
       ORDER BY c.updated_at DESC LIMIT $2`,
      [pattern, limit],
    );
    return result.rows.map(mapCourse);
  }

  public async upcomingAssignments(from: Date, to: Date, limit: number): Promise<AssignmentRow[]> {
    const result = await this.database.query<AssignmentDbRow>(
      `SELECT a.id, a.course_id, a.title, a.description, a.due_at, a.status,
              a.version, a.created_at, a.updated_at
       FROM course_assignments a JOIN courses c ON c.id=a.course_id
       WHERE c.archived=false AND a.status IN ('pending','in-progress')
         AND a.due_at IS NOT NULL AND a.due_at BETWEEN $1 AND $2
       ORDER BY a.due_at ASC LIMIT $3`,
      [from, to, limit],
    );
    return result.rows.map(mapAssignment);
  }

  private async touch(courseId: string, now: Date): Promise<void> {
    await this.database.query(`UPDATE courses SET updated_at=$2 WHERE id=$1`, [courseId, now]);
  }

  private async deleteChild(
    table: string,
    courseId: string,
    id: string,
    expectedVersion: number,
    now: Date,
  ): Promise<boolean> {
    const allowed = new Set([
      'course_class_records',
      'course_assignments',
      'course_material_groups',
      'course_materials',
    ]);
    if (!allowed.has(table)) throw new Error('不允许的课程子资源表。');
    const result = await this.database.query(
      `DELETE FROM ${table} WHERE course_id=$1 AND id=$2 AND version=$3`,
      [courseId, id, expectedVersion],
    );
    if ((result.rowCount ?? 0) === 1) await this.touch(courseId, now);
    return (result.rowCount ?? 0) === 1;
  }
}
