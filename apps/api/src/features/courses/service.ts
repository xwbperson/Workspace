import { randomUUID } from 'node:crypto';
import { AppError, ConflictError, NotFoundError } from '../../platform/errors.js';
import type { FileStorageService, StoredFile } from '../../platform/files/service.js';
import { type BookRepository, type BookRow, totalProgress } from '../books/index.js';
import {
  type AssignmentRow,
  type AssignmentStatus,
  type ClassRecordRow,
  type CourseRepository,
  type CourseRow,
  type MaterialGroupRow,
  type MaterialRow,
} from './repository.js';

export interface CourseInput {
  name: string;
  instructor?: string;
  courseCode?: string;
  credits?: number;
  totalHours?: number;
  objectives?: string;
  description?: string;
  schedule?: string;
  syllabusFileId?: string | null;
  referenceBookIds?: string[];
}

export interface CourseUpdateInput extends Partial<CourseInput> {
  version: number;
}

export interface ClassRecordInput {
  occurredAt: string;
  content: string;
}

export interface ClassRecordUpdateInput extends Partial<ClassRecordInput> {
  version: number;
}

export interface AssignmentInput {
  title: string;
  description?: string;
  dueAt?: string | null;
  status?: AssignmentStatus;
}

export interface AssignmentUpdateInput extends Partial<AssignmentInput> {
  version: number;
}

function text(value: string | undefined, fallback = ''): string {
  return value === undefined ? fallback : value.trim();
}

function storedFile(
  id: string | null,
  originalName: string | null,
  mimeType: string | null,
  size: number | null,
  createdAt: Date,
): StoredFile | undefined {
  if (!id || !originalName || !mimeType || size === null) return undefined;
  return {
    id,
    originalName,
    mimeType,
    size,
    createdAt: createdAt.toISOString(),
    contentUrl: `/api/v1/files/${id}/content`,
  };
}

function courseSummary(row: CourseRow) {
  const syllabus = storedFile(
    row.syllabusFileId,
    row.syllabusOriginalName,
    row.syllabusMimeType,
    row.syllabusSize,
    row.updatedAt,
  );
  return {
    id: row.id,
    name: row.name,
    instructor: row.instructor,
    courseCode: row.courseCode,
    credits: row.credits,
    totalHours: row.totalHours,
    objectives: row.objectives,
    description: row.description,
    schedule: row.schedule,
    ...(syllabus ? { syllabus } : {}),
    archived: row.archived,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function classRecordView(row: ClassRecordRow) {
  return {
    id: row.id,
    courseId: row.courseId,
    occurredAt: row.occurredAt.toISOString(),
    content: row.content,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assignmentView(row: AssignmentRow) {
  return {
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    description: row.description,
    ...(row.dueAt ? { dueAt: row.dueAt.toISOString() } : {}),
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function groupView(row: MaterialGroupRow) {
  return {
    id: row.id,
    courseId: row.courseId,
    name: row.name,
    position: row.position,
    version: row.version,
  };
}

function materialView(row: MaterialRow) {
  return {
    id: row.id,
    courseId: row.courseId,
    groupId: row.groupId,
    label: row.label || row.originalName,
    position: row.position,
    version: row.version,
    file: {
      id: row.fileId,
      originalName: row.originalName,
      mimeType: row.mimeType,
      size: row.size,
      createdAt: row.createdAt.toISOString(),
      contentUrl: `/api/v1/files/${row.fileId}/content`,
    },
  };
}

export class CourseService {
  public constructor(
    private readonly repository: CourseRepository,
    private readonly books: BookRepository,
    private readonly files: FileStorageService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async list(input: { archived?: boolean; limit?: number }) {
    return {
      items: (
        await this.repository.list(input.archived ?? false, Math.min(100, input.limit ?? 50))
      ).map(courseSummary),
    };
  }

  public async get(id: string) {
    const row = await this.requireCourse(id);
    const referenceBookIds = await this.repository.referenceBookIds(id);
    const referenceBooks = await Promise.all(
      referenceBookIds.map((bookId) => this.referenceBook(bookId)),
    );
    const [classRecords, assignments, materialGroups, materials] = await Promise.all([
      this.repository.listClassRecords(id),
      this.repository.listAssignments(id),
      this.repository.listMaterialGroups(id),
      this.repository.listMaterials(id),
    ]);
    return {
      ...courseSummary(row),
      referenceBooks,
      classRecords: classRecords.map(classRecordView),
      assignments: assignments.map(assignmentView),
      materialGroups: materialGroups.map(groupView),
      materials: materials.map(materialView),
    };
  }

  public async create(input: CourseInput) {
    if (!input.name.trim()) throw new AppError(400, 'COURSE_NAME_REQUIRED', '请输入课程名称。');
    await this.validateFilesAndBooks(input.syllabusFileId, input.referenceBookIds ?? []);
    const now = this.now();
    const row: CourseRow = {
      id: randomUUID(),
      name: input.name.trim(),
      instructor: text(input.instructor),
      courseCode: text(input.courseCode),
      credits: input.credits ?? 0,
      totalHours: input.totalHours ?? 0,
      objectives: text(input.objectives),
      description: text(input.description),
      schedule: text(input.schedule),
      syllabusFileId: input.syllabusFileId ?? null,
      syllabusOriginalName: null,
      syllabusMimeType: null,
      syllabusSize: null,
      archived: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.create(row);
    await this.repository.replaceReferenceBooks(row.id, input.referenceBookIds ?? []);
    return this.get(row.id);
  }

  public async update(id: string, input: CourseUpdateInput) {
    const existing = await this.requireActiveCourse(id);
    const referenceBookIds = input.referenceBookIds ?? (await this.repository.referenceBookIds(id));
    await this.validateFilesAndBooks(input.syllabusFileId, referenceBookIds);
    const next: CourseRow = {
      ...existing,
      name: input.name === undefined ? existing.name : input.name.trim(),
      instructor: text(input.instructor, existing.instructor),
      courseCode: text(input.courseCode, existing.courseCode),
      credits: input.credits ?? existing.credits,
      totalHours: input.totalHours ?? existing.totalHours,
      objectives: text(input.objectives, existing.objectives),
      description: text(input.description, existing.description),
      schedule: text(input.schedule, existing.schedule),
      syllabusFileId:
        input.syllabusFileId === undefined
          ? existing.syllabusFileId
          : (input.syllabusFileId ?? null),
      updatedAt: this.now(),
    };
    const updated = await this.repository.update(next, input.version);
    if (!updated) throw await this.versionConflict(id);
    if (input.referenceBookIds) {
      await this.repository.replaceReferenceBooks(id, input.referenceBookIds);
    }
    return this.get(id);
  }

  public async archive(id: string, version: number): Promise<void> {
    await this.requireActiveCourse(id);
    if (!(await this.repository.setArchived(id, true, version, this.now()))) {
      throw await this.versionConflict(id);
    }
  }

  public async restore(id: string, version: number) {
    const existing = await this.requireCourse(id);
    if (!existing.archived) {
      throw new ConflictError('该课程尚未归档，无需恢复。', { currentVersion: existing.version });
    }
    if (!(await this.repository.setArchived(id, false, version, this.now()))) {
      throw await this.versionConflict(id);
    }
    return this.get(id);
  }

  public async deletePermanently(id: string, version: number): Promise<void> {
    const existing = await this.requireCourse(id);
    if (!existing.archived) {
      throw new ConflictError('只能永久删除已归档的课程。', { currentVersion: existing.version });
    }
    if (!(await this.repository.deletePermanently(id, version)))
      throw await this.versionConflict(id);
  }

  public async createClassRecord(courseId: string, input: ClassRecordInput) {
    await this.requireActiveCourse(courseId);
    const now = this.now();
    return classRecordView(
      await this.repository.createClassRecord({
        id: randomUUID(),
        courseId,
        occurredAt: new Date(input.occurredAt),
        content: input.content.trim(),
        version: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  public async updateClassRecord(
    courseId: string,
    recordId: string,
    input: ClassRecordUpdateInput,
  ) {
    await this.requireActiveCourse(courseId);
    const existing = (await this.repository.listClassRecords(courseId)).find(
      (item) => item.id === recordId,
    );
    if (!existing) throw new NotFoundError('没有找到该上课记录。');
    const updated = await this.repository.updateClassRecord(
      {
        ...existing,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : existing.occurredAt,
        content: input.content === undefined ? existing.content : input.content.trim(),
        updatedAt: this.now(),
      },
      input.version,
    );
    if (!updated) throw new ConflictError('上课记录已变更，请刷新后重试。');
    return classRecordView(updated);
  }

  public async deleteClassRecord(
    courseId: string,
    recordId: string,
    version: number,
  ): Promise<void> {
    await this.requireActiveCourse(courseId);
    if (!(await this.repository.deleteClassRecord(courseId, recordId, version, this.now()))) {
      throw new ConflictError('上课记录不存在或已变更。');
    }
  }

  public async createAssignment(courseId: string, input: AssignmentInput) {
    await this.requireActiveCourse(courseId);
    const now = this.now();
    return assignmentView(
      await this.repository.createAssignment({
        id: randomUUID(),
        courseId,
        title: input.title.trim(),
        description: text(input.description),
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        status: input.status ?? 'pending',
        version: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  public async updateAssignment(
    courseId: string,
    assignmentId: string,
    input: AssignmentUpdateInput,
  ) {
    await this.requireActiveCourse(courseId);
    const existing = await this.repository.getAssignment(courseId, assignmentId);
    if (!existing) throw new NotFoundError('没有找到该作业。');
    const updated = await this.repository.updateAssignment(
      {
        ...existing,
        title: input.title === undefined ? existing.title : input.title.trim(),
        description: text(input.description, existing.description),
        dueAt:
          input.dueAt === undefined ? existing.dueAt : input.dueAt ? new Date(input.dueAt) : null,
        status: input.status ?? existing.status,
        updatedAt: this.now(),
      },
      input.version,
    );
    if (!updated) throw new ConflictError('作业已变更，请刷新后重试。');
    return assignmentView(updated);
  }

  public async deleteAssignment(
    courseId: string,
    assignmentId: string,
    version: number,
  ): Promise<void> {
    await this.requireActiveCourse(courseId);
    if (!(await this.repository.deleteAssignment(courseId, assignmentId, version, this.now()))) {
      throw new ConflictError('作业不存在或已变更。');
    }
  }

  public async createMaterialGroup(courseId: string, input: { name: string; position?: number }) {
    await this.requireActiveCourse(courseId);
    const now = this.now();
    return groupView(
      await this.repository.createMaterialGroup({
        id: randomUUID(),
        courseId,
        name: input.name.trim(),
        position: input.position ?? (await this.repository.listMaterialGroups(courseId)).length,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  public async deleteMaterialGroup(
    courseId: string,
    groupId: string,
    version: number,
  ): Promise<void> {
    await this.requireActiveCourse(courseId);
    if (!(await this.repository.deleteMaterialGroup(courseId, groupId, version, this.now()))) {
      throw new ConflictError('资料组不存在或已变更。');
    }
  }

  public async createMaterial(
    courseId: string,
    input: { fileId: string; groupId?: string | null; label?: string; position?: number },
  ) {
    await this.requireActiveCourse(courseId);
    const file = await this.files.get(input.fileId);
    if (input.groupId) {
      const group = (await this.repository.listMaterialGroups(courseId)).find(
        (candidate) => candidate.id === input.groupId,
      );
      if (!group) throw new AppError(400, 'MATERIAL_GROUP_INVALID', '资料组不属于当前课程。');
    }
    const now = this.now();
    const row: MaterialRow = {
      id: randomUUID(),
      courseId,
      groupId: input.groupId ?? null,
      fileId: input.fileId,
      label: text(input.label, file.originalName),
      position: input.position ?? (await this.repository.listMaterials(courseId)).length,
      version: 1,
      createdAt: now,
      updatedAt: now,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
    };
    return materialView(await this.repository.createMaterial(row));
  }

  public async deleteMaterial(
    courseId: string,
    materialId: string,
    version: number,
  ): Promise<void> {
    await this.requireActiveCourse(courseId);
    if (!(await this.repository.deleteMaterial(courseId, materialId, version, this.now()))) {
      throw new ConflictError('资料不存在或已变更。');
    }
  }

  private async validateFilesAndBooks(
    syllabusFileId: string | null | undefined,
    referenceBookIds: readonly string[],
  ): Promise<void> {
    if (syllabusFileId) await this.files.get(syllabusFileId);
    for (const id of [...new Set(referenceBookIds)]) {
      const book = await this.books.get(id);
      if (!book || book.archived) {
        throw new AppError(400, 'REFERENCE_BOOK_INVALID', '参考书必须从未归档的书籍中选择。');
      }
    }
  }

  private async referenceBook(id: string) {
    const row = await this.books.get(id);
    if (!row) throw new NotFoundError('参考书已不存在。');
    return this.referenceBookView(row);
  }

  private async referenceBookView(row: BookRow) {
    return {
      id: row.id,
      title: row.title,
      author: row.author,
      edition: row.edition,
      isbn: row.isbn,
      readingStatus: row.readingStatus,
      archived: row.archived,
      progress: totalProgress(await this.books.listChapters(row.id)),
      targetRoute: `/features/books/${row.id}`,
    };
  }

  private async requireCourse(id: string): Promise<CourseRow> {
    const row = await this.repository.get(id);
    if (!row) throw new NotFoundError('没有找到该课程。');
    return row;
  }

  private async requireActiveCourse(id: string): Promise<CourseRow> {
    const row = await this.requireCourse(id);
    if (row.archived)
      throw new ConflictError('请先恢复已归档的课程。', { currentVersion: row.version });
    return row;
  }

  private async versionConflict(id: string): Promise<ConflictError> {
    return new ConflictError('课程已在其他位置修改，请刷新后重试。', {
      currentVersion: (await this.repository.get(id))?.version,
    });
  }
}
