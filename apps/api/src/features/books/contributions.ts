import type { OverviewBlockData, RecentItem, SearchResultItem } from '@workspace/client-sdk';
import type { WorkbenchContributionProvider } from '../../app/workbench-contracts.js';
import type { BookRepository } from './repository.js';
import { totalProgress } from './service.js';

export function createBookContributions(
  repository: BookRepository,
  now: () => Date = () => new Date(),
): WorkbenchContributionProvider {
  return {
    featureId: 'books',
    async getRecent(limit): Promise<RecentItem[]> {
      return (await repository.recent(limit)).map((row) => ({
        featureId: 'books',
        recordId: row.id,
        type: '书籍',
        title: row.title,
        updatedAt: row.updatedAt.toISOString(),
        targetRoute: `/features/books/${row.id}`,
      }));
    },
    overviewBlocks: [
      {
        definition: {
          featureId: 'books',
          blockId: 'books:reading',
          title: '正在阅读',
          kind: 'progress',
          priority: 65,
          defaultVisible: true,
          targetRoute: '/features/books',
        },
        async getData(): Promise<OverviewBlockData> {
          const reading = await repository.list({
            archived: false,
            readingStatus: 'reading',
            limit: 20,
          });
          const chaptersByBook = await repository.listChaptersForBooks(
            reading.map((book) => book.id),
          );
          const chapterSets = reading.map((book) => chaptersByBook.get(book.id) ?? []);
          const readPages = chapterSets.reduce(
            (sum, chapters) => sum + totalProgress(chapters).readPages,
            0,
          );
          const totalPages = chapterSets.reduce(
            (sum, chapters) => sum + totalProgress(chapters).totalPages,
            0,
          );
          return {
            kind: 'progress',
            current: readPages,
            total: totalPages,
            label: `${reading.length} 本在读书籍的章节页码`,
            updatedAt: now().toISOString(),
          };
        },
      },
    ],
    search: {
      featureId: 'books',
      async search(input): Promise<{ items: SearchResultItem[] }> {
        return {
          items: (await repository.search(input.query, input.limit)).map((row) => ({
            featureId: 'books',
            recordId: row.id,
            type: '书籍',
            title: row.title,
            ...(row.author ? { snippet: row.author } : {}),
            updatedAt: row.updatedAt.toISOString(),
            targetRoute: `/features/books/${row.id}`,
          })),
        };
      },
    },
    quickCreateActions: [
      {
        featureId: 'books',
        actionId: 'create',
        label: '添加书籍',
        mode: 'open-route',
        targetRoute: '/features/books?create=1',
      },
    ],
  };
}
