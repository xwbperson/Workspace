import type { OverviewBlockData, RecentItem, SearchResultItem } from '@workspace/client-sdk';
import type { WorkbenchContributionProvider } from '../../app/workbench-contracts.js';
import type { InboxRepository } from './repository.js';

export function createInboxContributions(
  repository: InboxRepository,
  now: () => Date = () => new Date(),
): WorkbenchContributionProvider {
  return {
    featureId: 'inbox',
    async getRecent(limit): Promise<RecentItem[]> {
      return (await repository.recent(limit)).map((row) => ({
        featureId: 'inbox',
        recordId: row.id,
        type: '收集箱',
        title: row.title,
        updatedAt: row.updatedAt.toISOString(),
        targetRoute: `/features/inbox/${row.id}`,
      }));
    },
    overviewBlocks: [
      {
        definition: {
          featureId: 'inbox',
          blockId: 'inbox:unprocessed',
          title: '待整理收集',
          kind: 'metric',
          priority: 70,
          defaultVisible: true,
          targetRoute: '/features/inbox',
        },
        async getData(): Promise<OverviewBlockData> {
          const items = await repository.list('inbox', 500);
          return {
            kind: 'metric',
            value: items.length,
            label: '条内容等待整理',
            updatedAt: now().toISOString(),
          };
        },
      },
    ],
    search: {
      featureId: 'inbox',
      async search(input): Promise<{ items: SearchResultItem[] }> {
        return {
          items: (await repository.search(input.query, input.limit)).map((row) => ({
            featureId: 'inbox',
            recordId: row.id,
            type: '收集箱',
            title: row.title,
            ...(row.content ? { snippet: row.content } : row.url ? { snippet: row.url } : {}),
            updatedAt: row.updatedAt.toISOString(),
            targetRoute: `/features/inbox/${row.id}`,
          })),
        };
      },
    },
    quickCreateActions: [
      {
        featureId: 'inbox',
        actionId: 'create',
        label: '收集内容',
        mode: 'open-route',
        targetRoute: '/features/inbox?create=1',
      },
    ],
  };
}
