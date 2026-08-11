import type {
  OverviewBlockData,
  RecentItem,
  SearchResultItem,
  UpcomingItem,
} from '@workspace/client-sdk';
import type { WorkbenchContributionProvider } from '../../app/workbench-contracts.js';
import { expectedEndDate, type LifeCountdownRepository } from './repository.js';

export function createLifeCountdownContributions(
  repository: LifeCountdownRepository,
  now: () => Date = () => new Date(),
): WorkbenchContributionProvider {
  return {
    featureId: 'life-countdown',
    async getUpcoming(range): Promise<UpcomingItem[]> {
      const current = now();
      return (await repository.upcoming(new Date(range.from), new Date(range.to), 30)).map(
        (row) => ({
          featureId: 'life-countdown',
          recordId: row.id,
          type: '人生事件',
          title: row.title,
          occursAt: row.targetAt.toISOString(),
          state: row.targetAt.getTime() < current.getTime() ? 'overdue' : 'normal',
          targetRoute: `/features/life-countdown/${row.id}`,
        }),
      );
    },
    async getRecent(limit): Promise<RecentItem[]> {
      return (await repository.recent(limit)).map((row) => ({
        featureId: 'life-countdown',
        recordId: row.id,
        type: '人生事件',
        title: row.title,
        updatedAt: row.updatedAt.toISOString(),
        targetRoute: `/features/life-countdown/${row.id}`,
      }));
    },
    overviewBlocks: [
      {
        definition: {
          featureId: 'life-countdown',
          blockId: 'life-countdown:remaining-days',
          title: '人生时间',
          kind: 'metric',
          priority: 68,
          defaultVisible: false,
          targetRoute: '/features/life-countdown',
        },
        async getData(): Promise<OverviewBlockData> {
          const current = now();
          const profile = await repository.getProfile();
          const end = expectedEndDate(profile);
          const value = end
            ? Math.max(
                0,
                Math.ceil((Date.parse(`${end}T00:00:00Z`) - current.getTime()) / 86_400_000),
              )
            : 0;
          return {
            kind: 'metric',
            value,
            label: end ? `距离预期日期 ${end} 的天数` : '请先设置出生日期与预期寿命',
            updatedAt: current.toISOString(),
          };
        },
      },
    ],
    search: {
      featureId: 'life-countdown',
      async search(input): Promise<{ items: SearchResultItem[] }> {
        return {
          items: (await repository.search(input.query, input.limit)).map((row) => ({
            featureId: 'life-countdown',
            recordId: row.id,
            type: '人生事件',
            title: row.title,
            ...(row.note ? { snippet: row.note } : {}),
            updatedAt: row.updatedAt.toISOString(),
            targetRoute: `/features/life-countdown/${row.id}`,
          })),
        };
      },
    },
    quickCreateActions: [
      {
        featureId: 'life-countdown',
        actionId: 'create-event',
        label: '添加人生事件',
        mode: 'open-route',
        targetRoute: '/features/life-countdown?create=1',
      },
    ],
  };
}
