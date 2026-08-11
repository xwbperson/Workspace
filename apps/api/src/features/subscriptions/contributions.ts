import type {
  OverviewBlockData,
  RecentItem,
  SearchResultItem,
  UpcomingItem,
} from '@workspace/client-sdk';
import type { WorkbenchContributionProvider } from '../../app/workbench-contracts.js';
import { subscriptionMonthlyEquivalent, type SubscriptionRepository } from './repository.js';

export function createSubscriptionContributions(
  repository: SubscriptionRepository,
  now: () => Date = () => new Date(),
): WorkbenchContributionProvider {
  return {
    featureId: 'subscriptions',
    async getUpcoming(range): Promise<UpcomingItem[]> {
      return (await repository.upcoming(range.from.slice(0, 10), range.to.slice(0, 10), 30)).map(
        (row) => ({
          featureId: 'subscriptions',
          recordId: row.id,
          type: '续费',
          title: row.name,
          occursAt: `${row.renewalDate}T09:00:00.000Z`,
          state: 'normal',
          targetRoute: `/features/subscriptions/${row.id}`,
        }),
      );
    },
    async getRecent(limit): Promise<RecentItem[]> {
      return (await repository.recent(limit)).map((row) => ({
        featureId: 'subscriptions',
        recordId: row.id,
        type: '订阅',
        title: row.name,
        updatedAt: row.updatedAt.toISOString(),
        targetRoute: `/features/subscriptions/${row.id}`,
      }));
    },
    overviewBlocks: [
      {
        definition: {
          featureId: 'subscriptions',
          blockId: 'subscriptions:monthly-cost',
          title: '每月订阅折算',
          kind: 'metric',
          priority: 70,
          defaultVisible: true,
          targetRoute: '/features/subscriptions',
        },
        async getData(): Promise<OverviewBlockData> {
          const rows = await repository.list('active', 500);
          return {
            kind: 'metric',
            value: rows.reduce((sum, row) => sum + subscriptionMonthlyEquivalent(row), 0),
            label: 'CNY / 月（按当前活跃订阅折算）',
            updatedAt: now().toISOString(),
          };
        },
      },
    ],
    search: {
      featureId: 'subscriptions',
      async search(input): Promise<{ items: SearchResultItem[] }> {
        return {
          items: (await repository.search(input.query, input.limit)).map((row) => ({
            featureId: 'subscriptions',
            recordId: row.id,
            type: '订阅',
            title: row.name,
            snippet: `${row.currency} ${row.amount} · ${row.renewalDate}`,
            updatedAt: row.updatedAt.toISOString(),
            targetRoute: `/features/subscriptions/${row.id}`,
          })),
        };
      },
    },
    quickCreateActions: [
      {
        featureId: 'subscriptions',
        actionId: 'create',
        label: '添加订阅',
        mode: 'open-route',
        targetRoute: '/features/subscriptions?create=1',
      },
    ],
  };
}
