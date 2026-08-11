import type {
  FocusCandidate,
  OverviewBlockData,
  RecentItem,
  SearchResultItem,
  UpcomingItem,
} from '@workspace/client-sdk';
import type { WorkbenchContributionProvider } from '../../app/workbench-contracts.js';
import type { TaskRepository } from './repository.js';

const priorityValue = { low: 20, medium: 50, high: 80, urgent: 100 } as const;

export function createTaskContributions(
  repository: TaskRepository,
  now: () => Date = () => new Date(),
): WorkbenchContributionProvider {
  return {
    featureId: 'tasks',
    async getFocusCandidates(): Promise<FocusCandidate[]> {
      return (await repository.list('open', 6)).map((row) => ({
        featureId: 'tasks',
        recordId: row.id,
        title: row.title,
        state: row.status === 'in-progress' ? 'in-progress' : 'planned',
        priority: priorityValue[row.priority],
        ...(row.dueAt ? { dueAt: row.dueAt.toISOString() } : {}),
        targetRoute: `/features/tasks/${row.id}`,
      }));
    },
    async getUpcoming(range): Promise<UpcomingItem[]> {
      const current = now();
      return (await repository.upcoming(new Date(range.from), new Date(range.to), 30)).map(
        (row) => ({
          featureId: 'tasks',
          recordId: row.id,
          type: '任务',
          title: row.title,
          occursAt: row.dueAt!.toISOString(),
          state: row.dueAt!.getTime() < current.getTime() ? 'overdue' : 'normal',
          priority: priorityValue[row.priority],
          targetRoute: `/features/tasks/${row.id}`,
        }),
      );
    },
    async getRecent(limit): Promise<RecentItem[]> {
      return (await repository.recent(limit)).map((row) => ({
        featureId: 'tasks',
        recordId: row.id,
        type: '任务',
        title: row.title,
        updatedAt: row.updatedAt.toISOString(),
        targetRoute: `/features/tasks/${row.id}`,
      }));
    },
    overviewBlocks: [
      {
        definition: {
          featureId: 'tasks',
          blockId: 'tasks:open',
          title: '待推进任务',
          kind: 'metric',
          priority: 88,
          defaultVisible: true,
          targetRoute: '/features/tasks',
        },
        async getData(): Promise<OverviewBlockData> {
          const open = await repository.list('open', 500);
          return {
            kind: 'metric',
            value: open.length,
            label: '待办与进行中任务',
            updatedAt: now().toISOString(),
          };
        },
      },
    ],
    search: {
      featureId: 'tasks',
      async search(input): Promise<{ items: SearchResultItem[] }> {
        return {
          items: (await repository.search(input.query, input.limit)).map((row) => ({
            featureId: 'tasks',
            recordId: row.id,
            type: '任务',
            title: row.title,
            ...(row.description ? { snippet: row.description } : {}),
            updatedAt: row.updatedAt.toISOString(),
            targetRoute: `/features/tasks/${row.id}`,
          })),
        };
      },
    },
    quickCreateActions: [
      {
        featureId: 'tasks',
        actionId: 'create',
        label: '添加任务',
        mode: 'open-route',
        targetRoute: '/features/tasks?create=1',
      },
    ],
  };
}
