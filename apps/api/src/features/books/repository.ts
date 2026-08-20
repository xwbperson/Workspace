import type { Database } from '../../platform/database/types.js';

export type ReadingStatus = 'to-read' | 'reading' | 'read' | 'abandoned';

export interface BookRow {
  id: string;
  title: string;
  subtitle: string;
  originalTitle: string;
  author: string;
  translator: string;
  isbn: string;
  publisher: string;
  publishDate: string | null;
  edition: string;
  series: string;
  language: string;
  format: string;
  pageCount: number;
  description: string;
  notes: string;
  readingStatus: ReadingStatus;
  startedAt: string | null;
  finishedAt: string | null;
  coverFileId: string | null;
  coverOriginalName: string | null;
  coverMimeType: string | null;
  coverSize: number | null;
  archived: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChapterRow {
  id: string;
  bookId: string;
  title: string;
  startPage: number;
  endPage: number;
  currentPage: number;
  notes: string;
  position: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

interface BookDatabaseRow {
  id: string;
  title: string;
  subtitle: string;
  original_title: string;
  author: string;
  translator: string;
  isbn: string;
  publisher: string;
  publish_date: string | null;
  edition: string;
  series: string;
  language: string;
  format: string;
  page_count: number;
  description: string;
  notes: string;
  reading_status: ReadingStatus;
  started_at: string | null;
  finished_at: string | null;
  cover_file_id: string | null;
  cover_original_name: string | null;
  cover_mime_type: string | null;
  cover_size: string | number | null;
  archived: boolean;
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface ChapterDatabaseRow {
  id: string;
  book_id: string;
  title: string;
  start_page: number;
  end_page: number;
  current_page: number;
  notes: string;
  position: number;
  version: number;
  created_at: Date;
  updated_at: Date;
}

const BOOK_COLUMNS = `
  b.id, b.title, b.subtitle, b.original_title, b.author, b.translator, b.isbn,
  b.publisher, b.publish_date, b.edition, b.series, b.language, b.format,
  b.page_count, b.description, b.notes, b.reading_status, b.started_at, b.finished_at,
  b.cover_file_id, f.original_name AS cover_original_name, f.mime_type AS cover_mime_type,
  f.size_bytes AS cover_size, b.archived, b.version, b.created_at, b.updated_at`;

const CHAPTER_COLUMNS = `
  id, book_id, title, start_page, end_page, current_page, notes, position,
  version, created_at, updated_at`;

function mapBook(row: BookDatabaseRow): BookRow {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    originalTitle: row.original_title,
    author: row.author,
    translator: row.translator,
    isbn: row.isbn,
    publisher: row.publisher,
    publishDate: row.publish_date,
    edition: row.edition,
    series: row.series,
    language: row.language,
    format: row.format,
    pageCount: row.page_count,
    description: row.description,
    notes: row.notes,
    readingStatus: row.reading_status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    coverFileId: row.cover_file_id,
    coverOriginalName: row.cover_original_name,
    coverMimeType: row.cover_mime_type,
    coverSize: row.cover_size === null ? null : Number(row.cover_size),
    archived: row.archived,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChapter(row: ChapterDatabaseRow): ChapterRow {
  return {
    id: row.id,
    bookId: row.book_id,
    title: row.title,
    startPage: row.start_page,
    endPage: row.end_page,
    currentPage: row.current_page,
    notes: row.notes,
    position: row.position,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class BookRepository {
  public constructor(private readonly database: Database) {}

  public async list(input: {
    archived: boolean;
    readingStatus?: ReadingStatus;
    limit: number;
  }): Promise<BookRow[]> {
    const result = await this.database.query<BookDatabaseRow>(
      `SELECT ${BOOK_COLUMNS}
       FROM books b LEFT JOIN stored_files f ON f.id = b.cover_file_id
       WHERE b.archived = $1 AND ($2::text IS NULL OR b.reading_status = $2)
       ORDER BY b.updated_at DESC, b.title ASC, b.id ASC
       LIMIT $3`,
      [input.archived, input.readingStatus ?? null, input.limit],
    );
    return result.rows.map(mapBook);
  }

  public async get(id: string): Promise<BookRow | null> {
    const result = await this.database.query<BookDatabaseRow>(
      `SELECT ${BOOK_COLUMNS}
       FROM books b LEFT JOIN stored_files f ON f.id = b.cover_file_id
       WHERE b.id = $1`,
      [id],
    );
    return result.rows[0] ? mapBook(result.rows[0]) : null;
  }

  public async getMany(ids: readonly string[]): Promise<BookRow[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
    const result = await this.database.query<BookDatabaseRow>(
      `SELECT ${BOOK_COLUMNS}
       FROM books b LEFT JOIN stored_files f ON f.id = b.cover_file_id
       WHERE b.id IN (${placeholders})`,
      ids,
    );
    const rowsById = new Map(result.rows.map((row) => [row.id, mapBook(row)]));
    return ids.flatMap((id) => {
      const row = rowsById.get(id);
      return row ? [row] : [];
    });
  }

  public async create(row: BookRow): Promise<BookRow> {
    await this.database.query(
      `INSERT INTO books
         (id, title, subtitle, original_title, author, translator, isbn, publisher,
          publish_date, edition, series, language, format, page_count, description, notes,
          reading_status, started_at, finished_at, cover_file_id, archived, version,
          created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
      [
        row.id,
        row.title,
        row.subtitle,
        row.originalTitle,
        row.author,
        row.translator,
        row.isbn,
        row.publisher,
        row.publishDate,
        row.edition,
        row.series,
        row.language,
        row.format,
        row.pageCount,
        row.description,
        row.notes,
        row.readingStatus,
        row.startedAt,
        row.finishedAt,
        row.coverFileId,
        row.archived,
        row.version,
        row.createdAt,
        row.updatedAt,
      ],
    );
    return (await this.get(row.id))!;
  }

  public async update(row: BookRow, expectedVersion: number): Promise<BookRow | null> {
    const result = await this.database.query<{ id: string }>(
      `UPDATE books SET
         title=$2, subtitle=$3, original_title=$4, author=$5, translator=$6, isbn=$7,
         publisher=$8, publish_date=$9, edition=$10, series=$11, language=$12, format=$13,
         page_count=$14, description=$15, notes=$16, reading_status=$17, started_at=$18,
         finished_at=$19, cover_file_id=$20, version=version+1, updated_at=$21
       WHERE id=$1 AND version=$22 AND archived=false
       RETURNING id`,
      [
        row.id,
        row.title,
        row.subtitle,
        row.originalTitle,
        row.author,
        row.translator,
        row.isbn,
        row.publisher,
        row.publishDate,
        row.edition,
        row.series,
        row.language,
        row.format,
        row.pageCount,
        row.description,
        row.notes,
        row.readingStatus,
        row.startedAt,
        row.finishedAt,
        row.coverFileId,
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
  ): Promise<BookRow | null> {
    const result = await this.database.query<{ id: string }>(
      `UPDATE books SET archived=$2, version=version+1, updated_at=$4
       WHERE id=$1 AND version=$3 AND archived<>$2 RETURNING id`,
      [id, archived, expectedVersion, now],
    );
    return result.rows[0] ? this.get(id) : null;
  }

  public async deletePermanently(id: string, expectedVersion: number): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM books WHERE id=$1 AND version=$2 AND archived=true`,
      [id, expectedVersion],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async listChapters(bookId: string): Promise<ChapterRow[]> {
    const result = await this.database.query<ChapterDatabaseRow>(
      `SELECT ${CHAPTER_COLUMNS} FROM book_chapters
       WHERE book_id=$1 ORDER BY position ASC, start_page ASC, id ASC`,
      [bookId],
    );
    return result.rows.map(mapChapter);
  }

  public async listChaptersForBooks(
    bookIds: readonly string[],
  ): Promise<Map<string, ChapterRow[]>> {
    const chaptersByBook = new Map(bookIds.map((bookId) => [bookId, [] as ChapterRow[]]));
    if (bookIds.length === 0) return chaptersByBook;

    const placeholders = bookIds.map((_, index) => `$${index + 1}`).join(',');
    const result = await this.database.query<ChapterDatabaseRow>(
      `SELECT ${CHAPTER_COLUMNS} FROM book_chapters
       WHERE book_id IN (${placeholders})
       ORDER BY book_id ASC,position ASC,start_page ASC,id ASC`,
      bookIds,
    );
    for (const databaseRow of result.rows) {
      const chapter = mapChapter(databaseRow);
      chaptersByBook.get(chapter.bookId)?.push(chapter);
    }
    return chaptersByBook;
  }

  public async getChapter(bookId: string, chapterId: string): Promise<ChapterRow | null> {
    const result = await this.database.query<ChapterDatabaseRow>(
      `SELECT ${CHAPTER_COLUMNS} FROM book_chapters WHERE book_id=$1 AND id=$2`,
      [bookId, chapterId],
    );
    return result.rows[0] ? mapChapter(result.rows[0]) : null;
  }

  public async nextChapterPosition(bookId: string): Promise<number> {
    const result = await this.database.query<{ next_position: number }>(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next_position
       FROM book_chapters WHERE book_id=$1`,
      [bookId],
    );
    return Number(result.rows[0]?.next_position ?? 0);
  }

  public async createChapter(row: ChapterRow): Promise<ChapterRow> {
    const result = await this.database.query<ChapterDatabaseRow>(
      `INSERT INTO book_chapters
         (id, book_id, title, start_page, end_page, current_page, notes, position,
          version, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING ${CHAPTER_COLUMNS}`,
      [
        row.id,
        row.bookId,
        row.title,
        row.startPage,
        row.endPage,
        row.currentPage,
        row.notes,
        row.position,
        row.version,
        row.createdAt,
        row.updatedAt,
      ],
    );
    await this.touchBook(row.bookId, row.updatedAt);
    return mapChapter(result.rows[0]!);
  }

  public async updateChapter(row: ChapterRow, expectedVersion: number): Promise<ChapterRow | null> {
    const result = await this.database.query<ChapterDatabaseRow>(
      `UPDATE book_chapters SET title=$3, start_page=$4, end_page=$5, current_page=$6,
         notes=$7, position=$8, version=version+1, updated_at=$9
       WHERE book_id=$1 AND id=$2 AND version=$10
       RETURNING ${CHAPTER_COLUMNS}`,
      [
        row.bookId,
        row.id,
        row.title,
        row.startPage,
        row.endPage,
        row.currentPage,
        row.notes,
        row.position,
        row.updatedAt,
        expectedVersion,
      ],
    );
    if (!result.rows[0]) return null;
    await this.touchBook(row.bookId, row.updatedAt);
    return mapChapter(result.rows[0]);
  }

  public async deleteChapter(
    bookId: string,
    chapterId: string,
    expectedVersion: number,
    now: Date,
  ): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM book_chapters WHERE book_id=$1 AND id=$2 AND version=$3`,
      [bookId, chapterId, expectedVersion],
    );
    if ((result.rowCount ?? 0) === 1) await this.touchBook(bookId, now);
    return (result.rowCount ?? 0) === 1;
  }

  public async search(query: string, limit: number): Promise<BookRow[]> {
    const pattern = `%${query.toLocaleLowerCase('zh-CN')}%`;
    const result = await this.database.query<BookDatabaseRow>(
      `SELECT ${BOOK_COLUMNS}
       FROM books b LEFT JOIN stored_files f ON f.id=b.cover_file_id
       WHERE b.archived=false AND (
         LOWER(b.title) LIKE $1 OR LOWER(b.author) LIKE $1 OR LOWER(b.isbn) LIKE $1 OR
         LOWER(b.description) LIKE $1
       )
       ORDER BY b.updated_at DESC LIMIT $2`,
      [pattern, limit],
    );
    return result.rows.map(mapBook);
  }

  public async recent(limit: number): Promise<BookRow[]> {
    const result = await this.database.query<BookDatabaseRow>(
      `SELECT ${BOOK_COLUMNS}
       FROM books b LEFT JOIN stored_files f ON f.id=b.cover_file_id
       WHERE b.archived=false ORDER BY b.updated_at DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map(mapBook);
  }

  private async touchBook(bookId: string, now: Date): Promise<void> {
    await this.database.query(`UPDATE books SET updated_at=$2 WHERE id=$1`, [bookId, now]);
  }
}
