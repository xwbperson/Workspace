import type {
  BookChapterInput,
  BookChapterUpdateInput,
  BookInput,
  BookReadingStatus,
  BookUpdateInput,
} from '@workspace/client-sdk';
import { queryClient, workbenchClient } from '../../platform/api/client.js';

export const bookKeys = {
  all: ['books'] as const,
  list: (filter: string) => ['books', 'list', filter] as const,
  detail: (id: string) => ['books', 'detail', id] as const,
  chapter: (bookId: string, chapterId: string) => ['books', 'chapter', bookId, chapterId] as const,
};

export async function invalidateBookData(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: bookKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['courses'] }),
    queryClient.invalidateQueries({ queryKey: ['workbench', 'overview'] }),
  ]);
}

export const bookApi = {
  list(options: { archived?: boolean; readingStatus?: BookReadingStatus } = {}) {
    return workbenchClient.getBooks({ ...options, limit: 100 });
  },
  get(id: string) {
    return workbenchClient.getBook(id);
  },
  create(input: BookInput) {
    return workbenchClient.createBook(input);
  },
  update(id: string, input: BookUpdateInput) {
    return workbenchClient.updateBook(id, input);
  },
  archive(id: string, version: number) {
    return workbenchClient.archiveBook(id, version);
  },
  restore(id: string, version: number) {
    return workbenchClient.restoreBook(id, version);
  },
  deletePermanently(id: string, version: number) {
    return workbenchClient.deleteBookPermanently(id, version);
  },
  createChapter(bookId: string, input: BookChapterInput) {
    return workbenchClient.createBookChapter(bookId, input);
  },
  getChapter(bookId: string, chapterId: string) {
    return workbenchClient.getBookChapter(bookId, chapterId);
  },
  updateChapter(bookId: string, chapterId: string, input: BookChapterUpdateInput) {
    return workbenchClient.updateBookChapter(bookId, chapterId, input);
  },
  deleteChapter(bookId: string, chapterId: string, version: number) {
    return workbenchClient.deleteBookChapter(bookId, chapterId, version);
  },
  uploadFile(file: File) {
    return workbenchClient.uploadFile(file);
  },
};
