import { randomUUID } from 'node:crypto';
import { AppError, ConflictError, NotFoundError } from '../../platform/errors.js';
import type { FileStorageService, StoredFile } from '../../platform/files/service.js';
import {
  type BookRepository,
  type BookRow,
  type ChapterRow,
  type ReadingStatus,
} from './repository.js';

export interface BookInput {
  title: string;
  subtitle?: string;
  originalTitle?: string;
  author?: string;
  translator?: string;
  isbn?: string;
  publisher?: string;
  publishDate?: string | null;
  edition?: string;
  series?: string;
  language?: string;
  format?: string;
  pageCount?: number;
  description?: string;
  notes?: string;
  readingStatus?: ReadingStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  coverFileId?: string | null;
}

export interface BookUpdateInput extends Partial<BookInput> {
  version: number;
}

export interface ChapterInput {
  title: string;
  startPage: number;
  endPage: number;
  currentPage?: number;
  notes?: string;
  position?: number;
}

export interface ChapterUpdateInput extends Partial<ChapterInput> {
  version: number;
}

export interface ReadingProgress {
  readPages: number;
  totalPages: number;
  percentage: number;
}

function text(value: string | undefined, fallback = ''): string {
  return value === undefined ? fallback : value.trim();
}

function nullableDate(value: string | null | undefined, fallback: string | null): string | null {
  if (value === undefined) return fallback;
  return value || null;
}

export function chapterProgress(chapter: ChapterRow): ReadingProgress {
  const totalPages = Math.max(0, chapter.endPage - chapter.startPage + 1);
  const readPages = Math.max(0, Math.min(totalPages, chapter.currentPage - chapter.startPage + 1));
  return {
    readPages,
    totalPages,
    percentage: totalPages === 0 ? 0 : Math.round((readPages / totalPages) * 100),
  };
}

export function totalProgress(chapters: readonly ChapterRow[]): ReadingProgress {
  const totals = chapters.reduce(
    (sum, chapter) => {
      const progress = chapterProgress(chapter);
      return {
        readPages: sum.readPages + progress.readPages,
        totalPages: sum.totalPages + progress.totalPages,
      };
    },
    { readPages: 0, totalPages: 0 },
  );
  return {
    ...totals,
    percentage:
      totals.totalPages === 0 ? 0 : Math.round((totals.readPages / totals.totalPages) * 100),
  };
}

function coverFor(row: BookRow): StoredFile | undefined {
  if (!row.coverFileId || !row.coverOriginalName || !row.coverMimeType || row.coverSize === null) {
    return undefined;
  }
  return {
    id: row.coverFileId,
    originalName: row.coverOriginalName,
    mimeType: row.coverMimeType,
    size: row.coverSize,
    createdAt: row.updatedAt.toISOString(),
    contentUrl: `/api/v1/files/${row.coverFileId}/content`,
  };
}

function chapterView(row: ChapterRow) {
  return {
    id: row.id,
    bookId: row.bookId,
    title: row.title,
    startPage: row.startPage,
    endPage: row.endPage,
    currentPage: row.currentPage,
    notes: row.notes,
    position: row.position,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...chapterProgress(row),
  };
}

function bookView(row: BookRow, chapters: readonly ChapterRow[]) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    originalTitle: row.originalTitle,
    author: row.author,
    translator: row.translator,
    isbn: row.isbn,
    publisher: row.publisher,
    publishDate: row.publishDate,
    edition: row.edition,
    series: row.series,
    language: row.language,
    format: row.format,
    pageCount: row.pageCount,
    description: row.description,
    notes: row.notes,
    readingStatus: row.readingStatus,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    ...(coverFor(row) ? { cover: coverFor(row) } : {}),
    archived: row.archived,
    progress: totalProgress(chapters),
    chapterCount: chapters.length,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class BookService {
  public constructor(
    private readonly repository: BookRepository,
    private readonly files: FileStorageService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async list(input: { archived?: boolean; readingStatus?: ReadingStatus; limit?: number }) {
    const rows = await this.repository.list({
      archived: input.archived ?? false,
      ...(input.readingStatus ? { readingStatus: input.readingStatus } : {}),
      limit: Math.min(100, Math.max(1, input.limit ?? 50)),
    });
    return {
      items: await Promise.all(
        rows.map(async (row) => bookView(row, await this.repository.listChapters(row.id))),
      ),
    };
  }

  public async get(id: string) {
    const row = await this.requireBook(id);
    const chapters = await this.repository.listChapters(id);
    return { ...bookView(row, chapters), chapters: chapters.map(chapterView) };
  }

  public async create(input: BookInput) {
    if (!input.title.trim()) throw new AppError(400, 'BOOK_TITLE_REQUIRED', '请输入书名。');
    if (input.coverFileId) await this.files.get(input.coverFileId);
    const now = this.now();
    const row: BookRow = {
      id: randomUUID(),
      title: input.title.trim(),
      subtitle: text(input.subtitle),
      originalTitle: text(input.originalTitle),
      author: text(input.author),
      translator: text(input.translator),
      isbn: text(input.isbn),
      publisher: text(input.publisher),
      publishDate: nullableDate(input.publishDate, null),
      edition: text(input.edition),
      series: text(input.series),
      language: text(input.language),
      format: text(input.format),
      pageCount: input.pageCount ?? 0,
      description: text(input.description),
      notes: text(input.notes),
      readingStatus: input.readingStatus ?? 'to-read',
      startedAt: nullableDate(input.startedAt, null),
      finishedAt: nullableDate(input.finishedAt, null),
      coverFileId: input.coverFileId ?? null,
      coverOriginalName: null,
      coverMimeType: null,
      coverSize: null,
      archived: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.create(row);
    return this.get(row.id);
  }

  public async update(id: string, input: BookUpdateInput) {
    const existing = await this.requireActiveBook(id);
    if (input.title !== undefined && !input.title.trim()) {
      throw new AppError(400, 'BOOK_TITLE_REQUIRED', '请输入书名。');
    }
    if (input.coverFileId) await this.files.get(input.coverFileId);
    const next: BookRow = {
      ...existing,
      title: input.title === undefined ? existing.title : input.title.trim(),
      subtitle: text(input.subtitle, existing.subtitle),
      originalTitle: text(input.originalTitle, existing.originalTitle),
      author: text(input.author, existing.author),
      translator: text(input.translator, existing.translator),
      isbn: text(input.isbn, existing.isbn),
      publisher: text(input.publisher, existing.publisher),
      publishDate: nullableDate(input.publishDate, existing.publishDate),
      edition: text(input.edition, existing.edition),
      series: text(input.series, existing.series),
      language: text(input.language, existing.language),
      format: text(input.format, existing.format),
      pageCount: input.pageCount ?? existing.pageCount,
      description: text(input.description, existing.description),
      notes: text(input.notes, existing.notes),
      readingStatus: input.readingStatus ?? existing.readingStatus,
      startedAt: nullableDate(input.startedAt, existing.startedAt),
      finishedAt: nullableDate(input.finishedAt, existing.finishedAt),
      coverFileId:
        input.coverFileId === undefined ? existing.coverFileId : (input.coverFileId ?? null),
      updatedAt: this.now(),
    };
    const updated = await this.repository.update(next, input.version);
    if (!updated) throw await this.versionConflict(id);
    return this.get(id);
  }

  public async archive(id: string, version: number): Promise<void> {
    await this.requireActiveBook(id);
    if (!(await this.repository.setArchived(id, true, version, this.now()))) {
      throw await this.versionConflict(id);
    }
  }

  public async restore(id: string, version: number) {
    const existing = await this.requireBook(id);
    if (!existing.archived) {
      throw new ConflictError('该书籍尚未归档，无需恢复。', { currentVersion: existing.version });
    }
    const restored = await this.repository.setArchived(id, false, version, this.now());
    if (!restored) throw await this.versionConflict(id);
    return this.get(id);
  }

  public async deletePermanently(id: string, version: number): Promise<void> {
    const existing = await this.requireBook(id);
    if (!existing.archived) {
      throw new ConflictError('只能永久删除已归档的书籍。', { currentVersion: existing.version });
    }
    if (!(await this.repository.deletePermanently(id, version))) {
      throw await this.versionConflict(id);
    }
  }

  public async createChapter(bookId: string, input: ChapterInput) {
    await this.requireActiveBook(bookId);
    await this.validateChapterRange(bookId, input.startPage, input.endPage);
    const currentPage = input.currentPage ?? input.startPage - 1;
    if (currentPage < input.startPage - 1 || currentPage > input.endPage) {
      throw new AppError(400, 'CHAPTER_PROGRESS_INVALID', '已读页码必须位于章节页码范围内。');
    }
    const now = this.now();
    const row: ChapterRow = {
      id: randomUUID(),
      bookId,
      title: input.title.trim(),
      startPage: input.startPage,
      endPage: input.endPage,
      currentPage,
      notes: text(input.notes),
      position: input.position ?? (await this.repository.nextChapterPosition(bookId)),
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    return chapterView(await this.repository.createChapter(row));
  }

  public async getChapter(bookId: string, chapterId: string) {
    await this.requireBook(bookId);
    const chapter = await this.repository.getChapter(bookId, chapterId);
    if (!chapter) throw new NotFoundError('没有找到该章节。');
    return chapterView(chapter);
  }

  public async updateChapter(bookId: string, chapterId: string, input: ChapterUpdateInput) {
    await this.requireActiveBook(bookId);
    const existing = await this.repository.getChapter(bookId, chapterId);
    if (!existing) throw new NotFoundError('没有找到该章节。');
    const startPage = input.startPage ?? existing.startPage;
    const endPage = input.endPage ?? existing.endPage;
    await this.validateChapterRange(bookId, startPage, endPage, chapterId);
    const currentPage = input.currentPage ?? existing.currentPage;
    if (currentPage < startPage - 1 || currentPage > endPage) {
      throw new AppError(400, 'CHAPTER_PROGRESS_INVALID', '已读页码必须位于章节页码范围内。');
    }
    const updated = await this.repository.updateChapter(
      {
        ...existing,
        title: input.title === undefined ? existing.title : input.title.trim(),
        startPage,
        endPage,
        currentPage,
        notes: text(input.notes, existing.notes),
        position: input.position ?? existing.position,
        updatedAt: this.now(),
      },
      input.version,
    );
    if (!updated) {
      throw new ConflictError('章节已在其他位置修改，请刷新后重试。', {
        currentVersion: (await this.repository.getChapter(bookId, chapterId))?.version,
      });
    }
    return chapterView(updated);
  }

  public async deleteChapter(bookId: string, chapterId: string, version: number): Promise<void> {
    await this.requireActiveBook(bookId);
    if (!(await this.repository.deleteChapter(bookId, chapterId, version, this.now()))) {
      const current = await this.repository.getChapter(bookId, chapterId);
      if (!current) throw new NotFoundError('没有找到该章节。');
      throw new ConflictError('章节已在其他位置修改，请刷新后重试。', {
        currentVersion: current.version,
      });
    }
  }

  private async validateChapterRange(
    bookId: string,
    startPage: number,
    endPage: number,
    excludeId?: string,
  ): Promise<void> {
    if (startPage < 1 || endPage < startPage) {
      throw new AppError(400, 'CHAPTER_RANGE_INVALID', '章节起止页码无效。');
    }
    const overlaps = (await this.repository.listChapters(bookId)).some(
      (chapter) =>
        chapter.id !== excludeId && startPage <= chapter.endPage && endPage >= chapter.startPage,
    );
    if (overlaps) {
      throw new AppError(400, 'CHAPTER_RANGE_OVERLAP', '章节页码不能与已有章节重叠。');
    }
  }

  private async requireBook(id: string): Promise<BookRow> {
    const row = await this.repository.get(id);
    if (!row) throw new NotFoundError('没有找到该书籍。');
    return row;
  }

  private async requireActiveBook(id: string): Promise<BookRow> {
    const row = await this.requireBook(id);
    if (row.archived)
      throw new ConflictError('请先恢复已归档的书籍。', { currentVersion: row.version });
    return row;
  }

  private async versionConflict(id: string): Promise<ConflictError> {
    return new ConflictError('书籍已在其他位置修改，请刷新后重试。', {
      currentVersion: (await this.repository.get(id))?.version,
    });
  }
}
