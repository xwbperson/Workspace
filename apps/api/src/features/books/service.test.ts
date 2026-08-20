import { describe, expect, it, vi } from 'vitest';
import type { FileStorageService } from '../../platform/files/service.js';
import { createBookContributions } from './contributions.js';
import type { BookRepository, BookRow, ChapterRow } from './repository.js';
import { BookService } from './service.js';

const now = new Date('2030-01-01T00:00:00.000Z');

function book(id: string): BookRow {
  return {
    id,
    title: `书籍 ${id}`,
    subtitle: '',
    originalTitle: '',
    author: '',
    translator: '',
    isbn: '',
    publisher: '',
    publishDate: null,
    edition: '',
    series: '',
    language: '',
    format: '',
    pageCount: 10,
    description: '',
    notes: '',
    readingStatus: 'reading',
    startedAt: null,
    finishedAt: null,
    coverFileId: null,
    coverOriginalName: null,
    coverMimeType: null,
    coverSize: null,
    archived: false,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function chapter(bookId: string): ChapterRow {
  return {
    id: `chapter-${bookId}`,
    bookId,
    title: '第一章',
    startPage: 1,
    endPage: 10,
    currentPage: 5,
    notes: '',
    position: 0,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

describe('BookService batch hydration', () => {
  it('loads chapters for a list with one bulk repository call', async () => {
    const rows = [book('book-1'), book('book-2')];
    const listChaptersForBooks = vi.fn().mockResolvedValue(
      new Map([
        ['book-1', [chapter('book-1')]],
        ['book-2', [chapter('book-2')]],
      ]),
    );
    const listChapters = vi.fn();
    const repository = {
      list: vi.fn().mockResolvedValue(rows),
      listChaptersForBooks,
      listChapters,
    } as unknown as BookRepository;
    const service = new BookService(repository, {} as FileStorageService);

    const result = await service.list({ limit: 50 });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.chapterCount).toBe(1);
    expect(listChaptersForBooks).toHaveBeenCalledOnce();
    expect(listChaptersForBooks).toHaveBeenCalledWith(['book-1', 'book-2']);
    expect(listChapters).not.toHaveBeenCalled();
  });

  it('loads overview progress with one bulk repository call', async () => {
    const rows = [book('book-1'), book('book-2')];
    const listChaptersForBooks = vi.fn().mockResolvedValue(
      new Map([
        ['book-1', [chapter('book-1')]],
        ['book-2', [chapter('book-2')]],
      ]),
    );
    const listChapters = vi.fn();
    const repository = {
      list: vi.fn().mockResolvedValue(rows),
      listChaptersForBooks,
      listChapters,
    } as unknown as BookRepository;
    const provider = createBookContributions(repository, () => now);
    const overview = provider.overviewBlocks?.[0];
    expect(overview).toBeDefined();

    const result = await overview!.getData();

    expect(result).toMatchObject({ kind: 'progress', current: 10, total: 20 });
    expect(listChaptersForBooks).toHaveBeenCalledOnce();
    expect(listChapters).not.toHaveBeenCalled();
  });

  it('rejects non-image and oversized cover files before creating a book', async () => {
    const createBook = vi.fn();
    const repository = { create: createBook } as unknown as BookRepository;
    const files = {
      get: vi
        .fn()
        .mockResolvedValueOnce({ mimeType: 'text/plain', size: 100 })
        .mockResolvedValueOnce({ mimeType: 'image/png', size: 5 * 1024 * 1024 + 1 }),
    } as unknown as FileStorageService;
    const service = new BookService(repository, files);

    await expect(
      service.create({ title: '文本封面', coverFileId: 'file-1' }),
    ).rejects.toMatchObject({ code: 'BOOK_COVER_NOT_IMAGE' });
    await expect(
      service.create({ title: '超大封面', coverFileId: 'file-2' }),
    ).rejects.toMatchObject({ code: 'BOOK_COVER_TOO_LARGE' });
    expect(createBook).not.toHaveBeenCalled();
  });

  it('rejects impossible and reversed reading dates before writing a book', async () => {
    const createBook = vi.fn();
    const service = new BookService(
      { create: createBook } as unknown as BookRepository,
      {} as FileStorageService,
    );

    await expect(
      service.create({ title: '日期错误', publishDate: '2026-02-30' }),
    ).rejects.toMatchObject({ code: 'INVALID_BOOK_DATE' });
    await expect(
      service.create({ title: '顺序错误', startedAt: '2026-08-20', finishedAt: '2026-08-19' }),
    ).rejects.toMatchObject({ code: 'INVALID_READING_DATE_RANGE' });
    expect(createBook).not.toHaveBeenCalled();
  });
});
