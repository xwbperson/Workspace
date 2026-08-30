import type { OverviewBlockData, RecentItem, SearchResultItem } from '@workspace/client-sdk';
import type { WorkbenchContributionProvider } from '../../app/workbench-contracts.js';
import type { InventoryRepository } from './repository.js';

export function createInventoryContributions(
  repository: InventoryRepository,
  now: () => Date = () => new Date(),
): WorkbenchContributionProvider {
  return {
    featureId: 'inventory',
    async getRecent(limit): Promise<RecentItem[]> {
      return (await repository.recent(limit)).map((row) => ({
        featureId: 'inventory',
        recordId: row.id,
        type: '物品',
        title: row.name,
        updatedAt: row.updatedAt.toISOString(),
        targetRoute: '/features/inventory',
      }));
    },
    overviewBlocks: [
      {
        definition: {
          featureId: 'inventory',
          blockId: 'inventory:summary',
          title: '物品概况',
          kind: 'status',
          priority: 76,
          defaultVisible: true,
          targetRoute: '/features/inventory',
        },
        async getData(): Promise<OverviewBlockData> {
          const rows = await repository.listItems({ status: 'active', stock: 'all', limit: 500 });
          const total = rows.reduce((sum, row) => sum + row.quantity, 0);
          const zero = rows.filter((row) => row.quantity === 0).length;
          return {
            kind: 'status',
            level: zero ? 'warning' : 'normal',
            text: `${rows.length} 种物品 · 共 ${total} 件${zero ? ` · ${zero} 种数量为 0` : ''}`,
            updatedAt: now().toISOString(),
          };
        },
      },
    ],
    search: {
      featureId: 'inventory',
      async search(input): Promise<{ items: SearchResultItem[] }> {
        return {
          items: (await repository.search(input.query, input.limit)).map((row) => ({
            featureId: 'inventory',
            recordId: row.id,
            type: '物品',
            title: row.name,
            snippet: `${row.groupName ?? '无分组'} · 数量 ${row.quantity}${row.purpose ? ` · ${row.purpose}` : ''}`,
            updatedAt: row.updatedAt.toISOString(),
            targetRoute: '/features/inventory',
          })),
        };
      },
    },
    quickCreateActions: [
      {
        featureId: 'inventory',
        actionId: 'create',
        label: '添加物品',
        mode: 'open-route',
        targetRoute: '/features/inventory?create=1',
      },
    ],
  };
}
