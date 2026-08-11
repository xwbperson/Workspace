import type {
  FocusCandidate,
  OverviewBlock,
  OverviewContributionDefinition,
  QuickCreateActionDefinition,
  RecentItem,
  SearchResultItem,
  UpcomingItem,
} from '@workspace/client-sdk';

export interface FeatureSearchPage {
  items: SearchResultItem[];
  nextCursor?: string;
}

export interface FeatureSearchProvider {
  featureId: string;
  search(input: { query: string; limit: number; cursor?: string }): Promise<FeatureSearchPage>;
}

export interface OverviewBlockProvider {
  definition: OverviewContributionDefinition;
  getData(): Promise<OverviewBlock['data']>;
}

export interface WorkbenchContributionProvider {
  featureId: string;
  getFocusCandidates?(): Promise<FocusCandidate[]>;
  getUpcoming?(range: { from: string; to: string }): Promise<UpcomingItem[]>;
  getRecent?(limit: number): Promise<RecentItem[]>;
  overviewBlocks?: OverviewBlockProvider[];
  search?: FeatureSearchProvider;
  quickCreateActions?: QuickCreateActionDefinition[];
}
