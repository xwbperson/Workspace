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

export interface StoredFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  contentUrl: string;
}

export type BookReadingStatus = 'to-read' | 'reading' | 'read' | 'abandoned';

export interface ReadingProgress {
  readPages: number;
  totalPages: number;
  percentage: number;
}

export interface BookChapter extends ReadingProgress {
  id: string;
  bookId: string;
  title: string;
  startPage: number;
  endPage: number;
  currentPage: number;
  notes: string;
  position: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Book {
  id: string;
  title: string;
  subtitle: string;
  originalTitle: string;
  author: string;
  translator: string;
  isbn: string;
  publisher: string;
  publishDate: string | null;
  edition: string;
  series: string;
  language: string;
  format: string;
  pageCount: number;
  description: string;
  notes: string;
  readingStatus: BookReadingStatus;
  startedAt: string | null;
  finishedAt: string | null;
  cover?: StoredFile;
  archived: boolean;
  progress: ReadingProgress;
  chapterCount: number;
  chapters?: BookChapter[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookInput {
  title: string;
  subtitle?: string;
  originalTitle?: string;
  author?: string;
  translator?: string;
  isbn?: string;
  publisher?: string;
  publishDate?: string | null;
  edition?: string;
  series?: string;
  language?: string;
  format?: string;
  pageCount?: number;
  description?: string;
  notes?: string;
  readingStatus?: BookReadingStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  coverFileId?: string | null;
}

export interface BookUpdateInput extends Partial<BookInput> {
  version: number;
}

export interface BookChapterInput {
  title: string;
  startPage: number;
  endPage: number;
  currentPage?: number;
  notes?: string;
  position?: number;
}

export interface BookChapterUpdateInput extends Partial<BookChapterInput> {
  version: number;
}

export interface BookListResponse {
  items: Book[];
}

export type AssignmentStatus = 'pending' | 'in-progress' | 'completed' | 'abandoned';

export interface CourseReferenceBook {
  id: string;
  title: string;
  author: string;
  edition: string;
  isbn: string;
  readingStatus: BookReadingStatus;
  archived: boolean;
  progress: ReadingProgress;
  targetRoute: string;
}

export interface CourseClassRecord {
  id: string;
  courseId: string;
  occurredAt: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CourseAssignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueAt?: string;
  status: AssignmentStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CourseMaterialGroup {
  id: string;
  courseId: string;
  name: string;
  position: number;
  version: number;
}

export interface CourseMaterial {
  id: string;
  courseId: string;
  groupId: string | null;
  label: string;
  position: number;
  version: number;
  file: StoredFile;
}

export interface Course {
  id: string;
  name: string;
  instructor: string;
  courseCode: string;
  credits: number;
  totalHours: number;
  objectives: string;
  description: string;
  schedule: string;
  syllabus?: StoredFile;
  archived: boolean;
  referenceBooks?: CourseReferenceBook[];
  classRecords?: CourseClassRecord[];
  assignments?: CourseAssignment[];
  materialGroups?: CourseMaterialGroup[];
  materials?: CourseMaterial[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CourseInput {
  name: string;
  instructor?: string;
  courseCode?: string;
  credits?: number;
  totalHours?: number;
  objectives?: string;
  description?: string;
  schedule?: string;
  syllabusFileId?: string | null;
  referenceBookIds?: string[];
}

export interface CourseUpdateInput extends Partial<CourseInput> {
  version: number;
}

export interface CourseClassRecordInput {
  occurredAt: string;
  content: string;
}

export interface CourseClassRecordUpdateInput extends Partial<CourseClassRecordInput> {
  version: number;
}

export interface CourseAssignmentInput {
  title: string;
  description?: string;
  dueAt?: string | null;
  status?: AssignmentStatus;
}

export interface CourseAssignmentUpdateInput extends Partial<CourseAssignmentInput> {
  version: number;
}

export interface CourseListResponse {
  items: Course[];
}
