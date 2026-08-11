import type {
  FocusCandidate,
  OverviewBlockData,
  RecentItem,
  SearchResultItem,
  UpcomingItem,
} from '@workspace/client-sdk';
import type { WorkbenchContributionProvider } from '../../app/workbench-contracts.js';
import type { CountdownRepository } from './repository.js';

export function createCountdownContributions(
  repository: CountdownRepository,
  now: () => Date = () => new Date(),
): WorkbenchContributionProvider {
  return {
    featureId: 'countdowns',
    async getFocusCandidates(): Promise<FocusCandidate[]> {
      const current = now();
      return (await repository.nearestActive(4)).map((row) => ({
        featureId: 'countdowns',
        recordId: row.id,
        title: row.title,
        state: row.targetAt.getTime() < current.getTime() ? 'blocked' : 'planned',
        priority: row.priority,
        dueAt: row.targetAt.toISOString(),
        targetRoute: `/features/countdowns/${row.id}`,
      }));
    },
    async getUpcoming(range): Promise<UpcomingItem[]> {
      const current = now();
      return (
        await repository.upcoming({ from: new Date(range.from), to: new Date(range.to), limit: 20 })
      ).map((row) => ({
        featureId: 'countdowns',
        recordId: row.id,
        type: '倒计时',
        title: row.title,
        occursAt: row.targetAt.toISOString(),
        state:
          row.targetAt.getTime() < current.getTime()
            ? 'overdue'
            : row.targetAt.getTime() - current.getTime() <= 3 * 24 * 60 * 60 * 1000
              ? 'near'
              : 'normal',
        priority: row.priority,
        targetRoute: `/features/countdowns/${row.id}`,
      }));
    },
    async getRecent(limit): Promise<RecentItem[]> {
      return (await repository.recent(limit)).map((row) => ({
        featureId: 'countdowns',
        recordId: row.id,
        type: '倒计时',
        title: row.title,
        updatedAt: row.updatedAt.toISOString(),
        targetRoute: `/features/countdowns/${row.id}`,
      }));
    },
    overviewBlocks: [
      {
        definition: {
          featureId: 'countdowns',
          blockId: 'countdowns:nearest',
          title: '最近的倒计时',
          kind: 'upcoming',
          priority: 80,
          defaultVisible: true,
          targetRoute: '/features/countdowns',
        },
        async getData(): Promise<OverviewBlockData> {
          const rows = await repository.nearestActive(4);
          return {
            kind: 'upcoming',
            items: rows.map((row) => ({
              id: row.id,
              title: row.title,
              ...(row.note ? { subtitle: row.note } : {}),
              occurredAt: row.targetAt.toISOString(),
              targetRoute: `/features/countdowns/${row.id}`,
            })),
            updatedAt: now().toISOString(),
          };
        },
      },
    ],
    search: {
      featureId: 'countdowns',
      async search(input): Promise<{ items: SearchResultItem[] }> {
        const rows = await repository.search(input.query, input.limit);
        return {
          items: rows.map((row) => ({
            featureId: 'countdowns',
            recordId: row.id,
            type: '倒计时',
            title: row.title,
            ...(row.note ? { snippet: row.note } : {}),
            updatedAt: row.updatedAt.toISOString(),
            targetRoute: `/features/countdowns/${row.id}`,
          })),
        };
      },
    },
    quickCreateActions: [
      {
        featureId: 'countdowns',
        actionId: 'create',
        label: '添加倒计时',
        mode: 'open-route',
        targetRoute: '/features/countdowns?create=1',
      },
    ],
  };
}
