import type { OverviewBlockData, RecentItem, SearchResultItem } from '@workspace/client-sdk';
import type { WorkbenchContributionProvider } from '../../app/workbench-contracts.js';
import type { FinanceRepository } from './repository.js';

export function createFinanceContributions(
  repository: FinanceRepository,
  now: () => Date = () => new Date(),
): WorkbenchContributionProvider {
  return {
    featureId: 'finance',
    async getRecent(limit): Promise<RecentItem[]> {
      const rows = [
        ...(await repository.listAccounts(false)),
        ...(await repository.listPlatforms(false)),
      ]
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, limit);
      return rows.map((row) => ({
        featureId: 'finance',
        recordId: row.id,
        type: 'balance' in row ? '资金账户' : '负债平台',
        title: row.name,
        updatedAt: row.updatedAt.toISOString(),
        targetRoute: '/features/finance',
      }));
    },
    overviewBlocks: [
      {
        definition: {
          featureId: 'finance',
          blockId: 'finance:net-position',
          title: '当前净额',
          kind: 'metric',
          priority: 72,
          defaultVisible: true,
          targetRoute: '/features/finance',
        },
        async getData(): Promise<OverviewBlockData> {
          const date = now();
          const [accounts, records] = await Promise.all([
            repository.listAccounts(false),
            repository.listRecords(date.getUTCFullYear()),
          ]);
          const assets = accounts.reduce((sum, row) => sum + row.balance, 0);
          const debt = records
            .filter((row) => row.month === date.getUTCMonth() + 1)
            .reduce((sum, row) => sum + row.amount, 0);
          return {
            kind: 'metric',
            value: assets - debt,
            label: `资产 ${assets.toFixed(2)} · 本月负债 ${debt.toFixed(2)}`,
            updatedAt: date.toISOString(),
          };
        },
      },
    ],
    search: {
      featureId: 'finance',
      async search(input): Promise<{ items: SearchResultItem[] }> {
        const [accounts, platforms] = await Promise.all([
          repository.searchAccounts(input.query, input.limit),
          repository.searchPlatforms(input.query, input.limit),
        ]);
        return {
          items: [
            ...accounts.map((row) => ({
              featureId: 'finance',
              recordId: row.id,
              type: '资金账户',
              title: row.name,
              snippet: `余额 ${row.balance}`,
              updatedAt: row.updatedAt.toISOString(),
              targetRoute: '/features/finance',
            })),
            ...platforms.map((row) => ({
              featureId: 'finance',
              recordId: row.id,
              type: '负债平台',
              title: row.name,
              snippet: `剩余额度 ${row.remainingLimit}`,
              updatedAt: row.updatedAt.toISOString(),
              targetRoute: '/features/finance',
            })),
          ].slice(0, input.limit),
        };
      },
    },
    quickCreateActions: [
      {
        featureId: 'finance',
        actionId: 'create-account',
        label: '添加资金账户',
        mode: 'open-route',
        targetRoute: '/features/finance?create=account',
      },
    ],
  };
}
