export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
}

export interface OwnerProfile {
  id: string;
  username: 'owner';
}

export interface SessionView {
  sessionId: string;
  clientLabel: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  remembered: boolean;
}

export interface CurrentSessionResponse {
  authenticated: true;
  owner: OwnerProfile;
  session: SessionView;
}

export interface LoginInput {
  username: 'owner';
  password: string;
  remember: boolean;
  clientLabel?: string;
}

export type LoginResponse = CurrentSessionResponse;

export interface FeatureRuntimeState {
  featureId: string;
  availability: 'available' | 'needs-config' | 'degraded' | 'unavailable';
  entryMode: 'normal' | 'read-only' | 'configure' | 'disabled';
  enabledCapabilities: Array<'view' | 'create' | 'edit' | 'search' | 'overview'>;
  message?: string;
  actionRoute?: string;
  checkedAt: string;
}

export interface OverviewContributionDefinition {
  featureId: string;
  blockId: string;
  title: string;
  kind: 'metric' | 'progress' | 'recent-list' | 'upcoming' | 'status';
  priority: number;
  defaultVisible: boolean;
  targetRoute: string;
}

export interface OverviewListItem {
  id: string;
  title: string;
  subtitle?: string;
  occurredAt?: string;
  targetRoute: string;
}

export type OverviewBlockData =
  | { kind: 'metric'; value: number | string; label: string; updatedAt: string }
  | { kind: 'progress'; current: number; total: number; label: string; updatedAt: string }
  | { kind: 'recent-list' | 'upcoming'; items: OverviewListItem[]; updatedAt: string }
  | { kind: 'status'; level: 'normal' | 'warning' | 'error'; text: string; updatedAt: string };

export interface OverviewBlock {
  featureId: string;
  blockId: string;
  title: string;
  priority: number;
  targetRoute: string;
  data: OverviewBlockData;
}

export interface FocusCandidate {
  featureId: string;
  recordId: string;
  title: string;
  state: 'planned' | 'in-progress' | 'blocked';
  priority?: number;
  startsAt?: string;
  dueAt?: string;
  targetRoute: string;
}

export interface UpcomingItem {
  featureId: string;
  recordId: string;
  occurrenceId?: string;
  type: string;
  title: string;
  occursAt: string;
  state: 'normal' | 'near' | 'overdue' | 'completed';
  priority?: number;
  targetRoute: string;
}

export interface RecentItem {
  featureId: string;
  recordId: string;
  type: string;
  title: string;
  updatedAt: string;
  targetRoute: string;
}

export interface ContributionError {
  featureId: string;
  code: string;
  message: string;
}

export interface OverviewResponse {
  focus: {
    primary?: FocusCandidate;
    candidates: FocusCandidate[];
  };
  upcoming: UpcomingItem[];
  recent: RecentItem[];
  blocks: OverviewBlock[];
  errors: ContributionError[];
  updatedAt: string;
}

export interface WorkbenchPreferences {
  pinnedFeatureIds: string[];
  overviewBlockIds: string[];
  theme: 'system' | 'light' | 'dark';
  dateDisplay: 'relative' | 'absolute';
  notificationsEnabled: boolean;
  refreshIntervalMinutes: 0 | 1 | 5 | 15 | 30;
}

export interface SearchResultItem {
  featureId: string;
  recordId: string;
  type: string;
  title: string;
  snippet?: string;
  updatedAt?: string;
  targetRoute: string;
}

export interface SearchGroup {
  featureId: string;
  items: SearchResultItem[];
  error?: { code: string; message: string };
}

export interface SearchResponse {
  query: string;
  groups: SearchGroup[];
}

export interface QuickCreateActionDefinition {
  featureId: string;
  actionId: string;
  label: string;
  mode: 'open-route' | 'inline-title';
  targetRoute: string;
}

export interface WorkbenchNotification {
  notificationId: string;
  source: { kind: 'feature'; featureId: string } | { kind: 'system'; area: string };
  type: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  summary?: string;
  occurredAt: string;
  targetRoute?: string;
  requiresAction: boolean;
  readAt?: string;
}

export interface SystemStatus {
  connected: boolean;
  ready: boolean;
  version: string;
  workspaceId: string;
  databaseMigration: string;
  lastSuccessfulBackupAt?: string;
  lastRestoreVerifiedAt?: string;
  storage: {
    available: boolean;
    root: string;
  };
  checkedAt: string;
}

export interface Countdown {
  id: string;
  title: string;
  note: string;
  targetAt: string;
  status: 'active' | 'completed' | 'archived';
  priority: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CountdownInput {
  title: string;
  note?: string;
  targetAt: string;
  priority?: number;
}

export interface CountdownUpdateInput {
  title?: string;
  note?: string;
  targetAt?: string;
  status?: 'active' | 'completed';
  priority?: number;
  version: number;
}

export interface PaginatedCountdowns {
  items: Countdown[];
  nextCursor?: string;
}
