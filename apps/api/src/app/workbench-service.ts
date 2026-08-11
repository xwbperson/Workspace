import type {
  ContributionError,
  FeatureRuntimeState,
  FocusCandidate,
  OverviewBlock,
  OverviewContributionDefinition,
  OverviewResponse,
  QuickCreateActionDefinition,
  RecentItem,
  SearchResponse,
  WorkbenchPreferences,
} from '@workspace/client-sdk';
import type { PreferencesRepository } from '../platform/preferences/repository.js';
import type { WorkbenchContributionProvider } from './workbench-contracts.js';

const PROVIDER_TIMEOUT_MS = 3_000;

async function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), PROVIDER_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function errorFor(featureId: string, error: unknown): ContributionError {
  return {
    featureId,
    code: 'PROVIDER_FAILED',
    message: error instanceof Error ? error.message : '功能数据暂时不可用。',
  };
}

function focusScore(item: FocusCandidate, now: number): number {
  const stateScore = item.state === 'in-progress' ? 3 : item.state === 'blocked' ? 2 : 1;
  const priority = item.priority ?? 0;
  const due = item.dueAt ? new Date(item.dueAt).getTime() : Number.POSITIVE_INFINITY;
  const proximity = Number.isFinite(due) ? Math.max(0, 100 - Math.abs(due - now) / 86_400_000) : 0;
  return stateScore * 1_000 + priority * 10 + proximity;
}

export class WorkbenchService {
  public constructor(
    private readonly providers: readonly WorkbenchContributionProvider[],
    private readonly preferences: PreferencesRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public featureStates(): FeatureRuntimeState[] {
    const checkedAt = this.now().toISOString();
    return this.providers.map((provider) => ({
      featureId: provider.featureId,
      availability: 'available',
      entryMode: 'normal',
      enabledCapabilities: [
        'view',
        ...(provider.quickCreateActions ? (['create'] as const) : []),
        'edit',
        ...(provider.search ? (['search'] as const) : []),
        ...(provider.overviewBlocks ? (['overview'] as const) : []),
      ],
      checkedAt,
    }));
  }

  public overviewDefinitions(): OverviewContributionDefinition[] {
    return this.providers
      .flatMap((provider) => provider.overviewBlocks?.map((block) => block.definition) ?? [])
      .sort(
        (left, right) =>
          right.priority - left.priority || left.blockId.localeCompare(right.blockId),
      );
  }

  public defaultPreferences(): WorkbenchPreferences {
    return {
      pinnedFeatureIds: ['countdowns'],
      overviewBlockIds: this.overviewDefinitions()
        .filter((definition) => definition.defaultVisible)
        .map((definition) => definition.blockId),
      theme: 'system',
      dateDisplay: 'relative',
      notificationsEnabled: true,
      refreshIntervalMinutes: 5,
    };
  }

  public getPreferences(): Promise<WorkbenchPreferences> {
    return this.preferences.get(this.defaultPreferences());
  }

  public async savePreferences(input: WorkbenchPreferences): Promise<WorkbenchPreferences> {
    const visibleFeatures = new Set(this.providers.map((provider) => provider.featureId));
    const visibleBlocks = new Set(
      this.overviewDefinitions().map((definition) => definition.blockId),
    );
    const normalized: WorkbenchPreferences = {
      ...input,
      pinnedFeatureIds: [...new Set(input.pinnedFeatureIds)].filter((id) =>
        visibleFeatures.has(id),
      ),
      overviewBlockIds: [...new Set(input.overviewBlockIds)].filter((id) => visibleBlocks.has(id)),
    };
    return this.preferences.save(normalized);
  }

  public async overview(requestedBlockIds: string[]): Promise<OverviewResponse> {
    const errors: ContributionError[] = [];
    const now = this.now();
    const range = {
      from: new Date(now.getTime() - 30 * 86_400_000).toISOString(),
      to: new Date(now.getTime() + 90 * 86_400_000).toISOString(),
    };

    const focusResults = await Promise.all(
      this.providers.map(async (provider) => {
        if (!provider.getFocusCandidates) return [];
        try {
          return await withTimeout(
            provider.getFocusCandidates(),
            `${provider.featureId} 当前关注加载超时。`,
          );
        } catch (error) {
          errors.push(errorFor(provider.featureId, error));
          return [];
        }
      }),
    );

    const upcomingResults = await Promise.all(
      this.providers.map(async (provider) => {
        if (!provider.getUpcoming) return [];
        try {
          return await withTimeout(
            provider.getUpcoming(range),
            `${provider.featureId} 即将到来加载超时。`,
          );
        } catch (error) {
          errors.push(errorFor(provider.featureId, error));
          return [];
        }
      }),
    );

    const recentResults = await Promise.all(
      this.providers.map(async (provider) => {
        if (!provider.getRecent) return [];
        try {
          return await withTimeout(
            provider.getRecent(10),
            `${provider.featureId} 最近内容加载超时。`,
          );
        } catch (error) {
          errors.push(errorFor(provider.featureId, error));
          return [];
        }
      }),
    );

    const allowedBlocks = new Map(
      this.providers.flatMap((provider) =>
        (provider.overviewBlocks ?? []).map((block) => [block.definition.blockId, block] as const),
      ),
    );
    const blockResults = await Promise.all(
      [...new Set(requestedBlockIds)].flatMap((blockId) => {
        const provider = allowedBlocks.get(blockId);
        if (!provider) return [];
        return [
          withTimeout(provider.getData(), `${provider.definition.featureId} 摘要加载超时。`)
            .then((data): OverviewBlock => ({
              featureId: provider.definition.featureId,
              blockId: provider.definition.blockId,
              title: provider.definition.title,
              priority: provider.definition.priority,
              targetRoute: provider.definition.targetRoute,
              data,
            }))
            .catch((error: unknown) => {
              errors.push(errorFor(provider.definition.featureId, error));
              return null;
            }),
        ];
      }),
    );

    const focus = focusResults
      .flat()
      .sort(
        (left, right) =>
          focusScore(right, now.getTime()) - focusScore(left, now.getTime()) ||
          left.title.localeCompare(right.title),
      );
    const upcoming = upcomingResults
      .flat()
      .sort(
        (left, right) =>
          new Date(left.occursAt).getTime() - new Date(right.occursAt).getTime() ||
          (right.priority ?? 0) - (left.priority ?? 0) ||
          left.title.localeCompare(right.title),
      )
      .slice(0, 20);
    const recentByKey = new Map<string, RecentItem>();
    for (const item of recentResults.flat()) {
      const key = `${item.featureId}:${item.recordId}`;
      const current = recentByKey.get(key);
      if (!current || current.updatedAt < item.updatedAt) recentByKey.set(key, item);
    }
    const recent = [...recentByKey.values()]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 10);

    return {
      focus: {
        ...(focus[0] ? { primary: focus[0] } : {}),
        candidates: focus.slice(1, 4),
      },
      upcoming,
      recent,
      blocks: blockResults.filter((block): block is OverviewBlock => block !== null),
      errors,
      updatedAt: now.toISOString(),
    };
  }

  public async search(query: string): Promise<SearchResponse> {
    const groups = await Promise.all(
      this.providers
        .filter((provider) => provider.search)
        .map(async (provider) => {
          try {
            const result = await withTimeout(
              provider.search!.search({ query, limit: 10 }),
              `${provider.featureId} 搜索超时。`,
            );
            return { featureId: provider.featureId, items: result.items };
          } catch (error) {
            return {
              featureId: provider.featureId,
              items: [],
              error: errorFor(provider.featureId, error),
            };
          }
        }),
    );
    return { query, groups };
  }

  public quickActions(): QuickCreateActionDefinition[] {
    return this.providers.flatMap((provider) => provider.quickCreateActions ?? []);
  }
}
