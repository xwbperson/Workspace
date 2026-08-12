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
  hiddenFeatureIds: string[];
  sidebarFeatureOrder: string[];
  overviewBlockIds: string[];
  theme: 'light' | 'dark' | 'glass';
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

export type CourseStatus = 'in-progress' | 'completed';

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
  status: CourseStatus;
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
  status?: CourseStatus;
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

export type GoalPeriodType = 'annual' | 'quarterly' | 'monthly';
export type GoalStatus = 'active' | 'completed' | 'archived';
export type GoalMetricDirection = 'increase' | 'decrease';

export interface GoalKeyResult {
  id: string;
  title: string;
  progress: number;
  completed: boolean;
}

export interface GoalMetric {
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit: string;
  direction: GoalMetricDirection;
}

export interface GoalMeasurement {
  id: string;
  value: number;
  note: string;
  recordedAt: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  periodType: GoalPeriodType;
  periodLabel: string;
  startDate: string;
  endDate: string;
  status: GoalStatus;
  metric?: GoalMetric;
  keyResults: GoalKeyResult[];
  measurements?: GoalMeasurement[];
  progress: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoalInput {
  title: string;
  description?: string;
  periodType: GoalPeriodType;
  periodLabel: string;
  startDate: string;
  endDate: string;
  status?: Exclude<GoalStatus, 'archived'>;
  metric?: GoalMetric | null;
  keyResults?: GoalKeyResult[];
}

export interface GoalUpdateInput extends Partial<GoalInput> {
  version: number;
}

export interface GoalMeasurementInput {
  value: number;
  note?: string;
  recordedAt?: string;
  version: number;
}

export interface GoalListResponse {
  items: Goal[];
}

export type TaskStatus = 'todo' | 'in-progress' | 'completed' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt?: string;
  recurrence: TaskRecurrence;
  parentId: string | null;
  recurrenceSourceId: string | null;
  completedAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title: string;
  description?: string;
  status?: Exclude<TaskStatus, 'completed' | 'archived'>;
  priority?: TaskPriority;
  dueAt?: string | null;
  recurrence?: TaskRecurrence;
  parentId?: string | null;
}

export interface TaskUpdateInput extends Omit<Partial<TaskInput>, 'status'> {
  status?: Exclude<TaskStatus, 'archived'>;
  version: number;
}

export interface TaskCompletion {
  completed: Task;
  nextTask?: Task;
}

export interface TaskListResponse {
  items: Task[];
}

export type CalendarEntryType = 'schedule' | 'journal' | 'summary';
export type CalendarEntryStatus = 'active' | 'archived';

export interface CalendarEntry {
  id: string;
  type: CalendarEntryType;
  title: string;
  content: string;
  entryDate: string;
  startsAt?: string;
  endsAt?: string;
  status: CalendarEntryStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEntryInput {
  type: CalendarEntryType;
  title: string;
  content?: string;
  entryDate: string;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface CalendarEntryUpdateInput extends Partial<CalendarEntryInput> {
  version: number;
}

export interface CalendarEntryListResponse {
  items: CalendarEntry[];
}

export type TimetableEntityStatus = 'active' | 'archived';
export type TimetableColor = 'teal' | 'blue' | 'violet' | 'amber' | 'rose' | 'slate';
export type TimetableAdjustmentType = 'cancel' | 'reschedule' | 'override';

export interface TimetableTimeBlock {
  id: string;
  semesterId: string;
  label: string;
  sourceLabel: string;
  startTime: string;
  endTime: string;
  position: number;
  version: number;
}

export interface TimetableSemester {
  id: string;
  name: string;
  shortName: string;
  firstWeekMonday: string;
  totalWeeks: number;
  isCurrent: boolean;
  showWeekend: boolean;
  status: TimetableEntityStatus;
  timeBlocks: TimetableTimeBlock[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimetableSemesterInput {
  name: string;
  shortName: string;
  firstWeekMonday: string;
  totalWeeks: number;
  showWeekend?: boolean;
  makeCurrent?: boolean;
}

export interface TimetableSemesterUpdateInput extends Partial<TimetableSemesterInput> {
  version: number;
}

export interface TimetableTimeBlockInput {
  id: string;
  label: string;
  sourceLabel?: string;
  startTime: string;
  endTime: string;
  position: number;
  version: number;
}

export interface TimetableTimeBlocksUpdateInput {
  semesterVersion: number;
  blocks: TimetableTimeBlockInput[];
}

export interface TimetableMeeting {
  id: string;
  courseId: string;
  timeBlockId: string;
  weekday: number;
  room: string;
  instructorOverride: string[];
  weekNumbers: number[];
  position: number;
  version: number;
}

export interface TimetableMeetingInput {
  id?: string;
  timeBlockId: string;
  weekday: number;
  room?: string;
  instructorOverride?: string[];
  weekNumbers: number[];
}

export interface TimetableCourse {
  id: string;
  semesterId: string;
  name: string;
  shortName: string;
  instructors: string[];
  color: TimetableColor;
  notes: string;
  status: TimetableEntityStatus;
  meetings: TimetableMeeting[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimetableCourseInput {
  semesterId: string;
  name: string;
  shortName?: string;
  instructors?: string[];
  color?: TimetableColor;
  notes?: string;
  meetings: TimetableMeetingInput[];
  allowConflicts?: boolean;
}

export interface TimetableCourseUpdateInput extends Partial<TimetableCourseInput> {
  version: number;
}

export interface TimetableAdjustment {
  id: string;
  courseId: string;
  meetingId: string;
  originalDate: string;
  type: TimetableAdjustmentType;
  newDate?: string;
  newTimeBlockId?: string;
  room?: string;
  instructors?: string[];
  note: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimetableAdjustmentInput {
  meetingId: string;
  originalDate: string;
  type: TimetableAdjustmentType;
  newDate?: string | null;
  newTimeBlockId?: string | null;
  room?: string | null;
  instructors?: string[] | null;
  note?: string;
}

export interface TimetableAdjustmentUpdateInput extends Partial<TimetableAdjustmentInput> {
  version: number;
}

export interface TimetableOccurrence {
  occurrenceId: string;
  courseId: string;
  meetingId: string;
  semesterId: string;
  date: string;
  originalDate: string;
  weekNumber: number;
  weekday: number;
  courseName: string;
  courseShortName: string;
  instructors: string[];
  room: string;
  color: TimetableColor;
  notes: string;
  weekLabel: string;
  timeBlock: TimetableTimeBlock;
  conflict: boolean;
  cancelled: boolean;
  adjustment?: TimetableAdjustment;
}

export interface TimetableSemesterListResponse {
  items: TimetableSemester[];
}

export interface TimetableCourseListResponse {
  items: TimetableCourse[];
}

export interface TimetableOccurrenceListResponse {
  semester: TimetableSemester;
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  items: TimetableOccurrence[];
}

export type InboxItemType =
  'idea' | 'inspiration' | 'snippet' | 'article' | 'link' | 'file' | 'information' | 'other';
export type InboxItemStatus = 'inbox' | 'processed' | 'archived';

export interface InboxItem {
  id: string;
  type: InboxItemType;
  title: string;
  content: string;
  url: string;
  file?: StoredFile;
  status: InboxItemStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface InboxItemInput {
  type: InboxItemType;
  title: string;
  content?: string;
  url?: string;
  fileId?: string | null;
  status?: Exclude<InboxItemStatus, 'archived'>;
}

export interface InboxItemUpdateInput extends Partial<InboxItemInput> {
  version: number;
}

export interface InboxItemListResponse {
  items: InboxItem[];
}

export type SubscriptionCategory = 'software' | 'membership' | 'domain' | 'server' | 'other';
export type SubscriptionBillingCycle = 'monthly' | 'quarterly' | 'yearly';
export type SubscriptionStatus = 'active' | 'expired' | 'archived';

export interface Subscription {
  id: string;
  name: string;
  category: SubscriptionCategory;
  amount: number;
  currency: string;
  billingCycle: SubscriptionBillingCycle;
  monthlyEquivalent: number;
  renewalDate: string;
  autoRenew: boolean;
  note: string;
  status: SubscriptionStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionInput {
  name: string;
  category: SubscriptionCategory;
  amount: number;
  currency?: string;
  billingCycle: SubscriptionBillingCycle;
  renewalDate: string;
  autoRenew?: boolean;
  note?: string;
  status?: Exclude<SubscriptionStatus, 'archived'>;
}

export interface SubscriptionUpdateInput extends Partial<SubscriptionInput> {
  version: number;
}

export interface SubscriptionListResponse {
  items: Subscription[];
}

export type FinanceAccountType =
  'cash' | 'alipay' | 'wechat' | 'bank' | 'credit' | 'digital-cny' | 'other';
export interface FinanceAccount {
  id: string;
  type: FinanceAccountType;
  name: string;
  balance: number;
  cardNumber: string | null;
  phone: string | null;
  creditLimit: number | null;
  note: string;
  archived: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface FinanceAccountInput {
  type: FinanceAccountType;
  name?: string;
  balance?: number;
  cardNumber?: string;
  phone?: string;
  creditLimit?: number;
  note?: string;
}
export interface FinanceAccountUpdateInput extends Partial<FinanceAccountInput> {
  version: number;
}
export interface FinanceDebtPlatform {
  id: string;
  name: string;
  billingDay: number | null;
  repaymentDay: number | null;
  fixedLimit: number;
  temporaryLimit: number;
  remainingLimit: number;
  note: string;
  archived: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface FinanceDebtPlatformInput {
  name: string;
  billingDay?: number | null;
  repaymentDay?: number | null;
  fixedLimit?: number;
  temporaryLimit?: number;
  remainingLimit?: number;
  note?: string;
}
export interface FinanceDebtPlatformUpdateInput extends Partial<FinanceDebtPlatformInput> {
  version: number;
}
export interface FinanceDebtRecord {
  id: string;
  platformId: string;
  platformName: string;
  year: number;
  month: number;
  amount: number;
  version: number;
  updatedAt: string;
}
export interface FinanceDebtRecordInput {
  platformId: string;
  year: number;
  month: number;
  amount: number;
  version?: number;
}
export interface FinanceSummary {
  year: number;
  month: number;
  totalAssets: number;
  currentMonthDebt: number;
  yearDebt: number;
  netPosition: number;
  totalCreditLimit: number;
  remainingCredit: number;
  accounts: FinanceAccount[];
  platforms: FinanceDebtPlatform[];
  records: FinanceDebtRecord[];
}

export interface LifeProfile {
  birthDate: string | null;
  expectedAge: number;
  expectedEndDate: string | null;
  version: number;
  updatedAt: string;
}
export interface LifeProfileInput {
  birthDate: string;
  expectedAge: number;
  version: number;
}
export type LifeEventStatus = 'active' | 'archived';
export interface LifeEvent {
  id: string;
  title: string;
  targetAt: string;
  note: string;
  status: LifeEventStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface LifeEventInput {
  title: string;
  targetAt: string;
  note?: string;
}
export interface LifeEventUpdateInput extends Partial<LifeEventInput> {
  version: number;
}
export interface LifeCountdownDashboard {
  profile: LifeProfile;
  events: LifeEvent[];
}
