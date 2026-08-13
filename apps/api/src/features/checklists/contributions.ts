import type { OverviewBlockData, RecentItem, SearchResultItem } from '@workspace/client-sdk';
import type { WorkbenchContributionProvider } from '../../app/workbench-contracts.js';
import type { ChecklistService } from './service.js';

function summary(checked: number, total: number, amount: number): string {
  const progress = `${checked}/${total} 已勾选`;
  return amount > 0 ? `${progress} · ¥${amount.toFixed(2)}` : progress;
}

export function createChecklistContributions(
  service: ChecklistService,
  now: () => Date = () => new Date(),
): WorkbenchContributionProvider {
  return {
    featureId: 'checklists',
    async getRecent(limit): Promise<RecentItem[]> {
      return (await service.recent(limit)).map((checklist) => ({
        featureId: 'checklists',
        recordId: checklist.id,
        type: '清单',
        title: checklist.name,
        updatedAt: checklist.updatedAt,
        targetRoute: `/features/checklists/${checklist.id}`,
      }));
    },
    overviewBlocks: [
      {
        definition: {
          featureId: 'checklists',
          blockId: 'checklists:active',
          title: '常用清单',
          kind: 'recent-list',
          priority: 68,
          defaultVisible: true,
          targetRoute: '/features/checklists',
        },
        async getData(): Promise<OverviewBlockData> {
          const rows = (await service.list({ status: 'active', limit: 5 })).items;
          return {
            kind: 'recent-list',
            items: rows.map((checklist) => ({
              id: checklist.id,
              title: checklist.name,
              subtitle: summary(
                checklist.progress.checked,
                checklist.progress.total,
                checklist.amounts.total,
              ),
              targetRoute: `/features/checklists/${checklist.id}`,
            })),
            updatedAt: now().toISOString(),
          };
        },
      },
    ],
    search: {
      featureId: 'checklists',
      async search(input): Promise<{ items: SearchResultItem[] }> {
        return {
          items: (await service.search(input.query, input.limit)).map((checklist) => ({
            featureId: 'checklists',
            recordId: checklist.id,
            type: '清单',
            title: checklist.name,
            snippet:
              checklist.note ||
              summary(
                checklist.progress.checked,
                checklist.progress.total,
                checklist.amounts.total,
              ),
            updatedAt: checklist.updatedAt,
            targetRoute: `/features/checklists/${checklist.id}`,
          })),
        };
      },
    },
    quickCreateActions: [
      {
        featureId: 'checklists',
        actionId: 'create',
        label: '新建清单',
        mode: 'open-route',
        targetRoute: '/features/checklists?create=1',
      },
    ],
  };
}
