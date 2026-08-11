import type { OverviewBlockData, RecentItem, SearchResultItem } from '@workspace/client-sdk';
import type { WorkbenchContributionProvider } from '../../app/workbench-contracts.js';
import type { GoalRepository } from './repository.js';
import { goalProgress } from './service.js';

export function createGoalContributions(
  repository: GoalRepository,
  now: () => Date = () => new Date(),
): WorkbenchContributionProvider {
  return {
    featureId: 'goals',
    async getFocusCandidates() {
      return (await repository.list('active', 4)).map((row) => ({
        featureId: 'goals',
        recordId: row.id,
        title: row.title,
        state: 'in-progress' as const,
        priority: Math.max(1, 100 - goalProgress(row)),
        dueAt: `${row.endDate}T23:59:59.999Z`,
        targetRoute: `/features/goals/${row.id}`,
      }));
    },
    async getRecent(limit): Promise<RecentItem[]> {
      return (await repository.recent(limit)).map((row) => ({
        featureId: 'goals',
        recordId: row.id,
        type: '目标',
        title: row.title,
        updatedAt: row.updatedAt.toISOString(),
        targetRoute: `/features/goals/${row.id}`,
      }));
    },
    overviewBlocks: [
      {
        definition: {
          featureId: 'goals',
          blockId: 'goals:active-progress',
          title: '目标推进',
          kind: 'progress',
          priority: 90,
          defaultVisible: true,
          targetRoute: '/features/goals',
        },
        async getData(): Promise<OverviewBlockData> {
          const active = await repository.list('active', 100);
          return {
            kind: 'progress',
            current: active.reduce((sum, row) => sum + goalProgress(row), 0),
            total: active.length * 100,
            label: `${active.length} 个进行中目标的综合进度`,
            updatedAt: now().toISOString(),
          };
        },
      },
    ],
    search: {
      featureId: 'goals',
      async search(input): Promise<{ items: SearchResultItem[] }> {
        return {
          items: (await repository.search(input.query, input.limit)).map((row) => ({
            featureId: 'goals',
            recordId: row.id,
            type: '目标',
            title: row.title,
            snippet: `${row.periodLabel} · ${goalProgress(row)}%`,
            updatedAt: row.updatedAt.toISOString(),
            targetRoute: `/features/goals/${row.id}`,
          })),
        };
      },
    },
    quickCreateActions: [
      {
        featureId: 'goals',
        actionId: 'create',
        label: '添加目标',
        mode: 'open-route',
        targetRoute: '/features/goals?create=1',
      },
    ],
  };
}
