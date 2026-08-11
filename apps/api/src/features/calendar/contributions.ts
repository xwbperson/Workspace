import type {
  OverviewBlockData,
  RecentItem,
  SearchResultItem,
  UpcomingItem,
} from '@workspace/client-sdk';
import type { WorkbenchContributionProvider } from '../../app/workbench-contracts.js';
import type { CalendarRepository } from './repository.js';

export function createCalendarContributions(
  repository: CalendarRepository,
  now: () => Date = () => new Date(),
): WorkbenchContributionProvider {
  return {
    featureId: 'calendar',
    async getUpcoming(range): Promise<UpcomingItem[]> {
      const current = now();
      return (await repository.upcoming(new Date(range.from), new Date(range.to), 30)).map(
        (row) => ({
          featureId: 'calendar',
          recordId: row.id,
          type: '日程',
          title: row.title,
          occursAt: row.startsAt!.toISOString(),
          state: row.startsAt!.getTime() < current.getTime() ? 'overdue' : 'normal',
          targetRoute: `/features/calendar/${row.id}`,
        }),
      );
    },
    async getRecent(limit): Promise<RecentItem[]> {
      return (await repository.recent(limit)).map((row) => ({
        featureId: 'calendar',
        recordId: row.id,
        type: row.type === 'schedule' ? '日程' : row.type === 'journal' ? '日记' : '总结',
        title: row.title,
        updatedAt: row.updatedAt.toISOString(),
        targetRoute: `/features/calendar/${row.id}`,
      }));
    },
    overviewBlocks: [
      {
        definition: {
          featureId: 'calendar',
          blockId: 'calendar:upcoming',
          title: '近期日程',
          kind: 'upcoming',
          priority: 86,
          defaultVisible: true,
          targetRoute: '/features/calendar',
        },
        async getData(): Promise<OverviewBlockData> {
          const current = now();
          const rows = await repository.upcoming(
            current,
            new Date(current.getTime() + 30 * 86_400_000),
            5,
          );
          return {
            kind: 'upcoming',
            items: rows.map((row) => ({
              id: row.id,
              title: row.title,
              subtitle: row.content || '行程安排',
              occurredAt: row.startsAt!.toISOString(),
              targetRoute: `/features/calendar/${row.id}`,
            })),
            updatedAt: current.toISOString(),
          };
        },
      },
    ],
    search: {
      featureId: 'calendar',
      async search(input): Promise<{ items: SearchResultItem[] }> {
        return {
          items: (await repository.search(input.query, input.limit)).map((row) => ({
            featureId: 'calendar',
            recordId: row.id,
            type: row.type === 'schedule' ? '日程' : row.type === 'journal' ? '日记' : '总结',
            title: row.title,
            ...(row.content ? { snippet: row.content } : {}),
            updatedAt: row.updatedAt.toISOString(),
            targetRoute: `/features/calendar/${row.id}`,
          })),
        };
      },
    },
    quickCreateActions: [
      {
        featureId: 'calendar',
        actionId: 'create',
        label: '添加日程',
        mode: 'open-route',
        targetRoute: '/features/calendar?create=1',
      },
    ],
  };
}
