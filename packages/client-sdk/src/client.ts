import type {
  ApiErrorBody,
  Book,
  BookChapter,
  BookChapterInput,
  BookChapterUpdateInput,
  BookInput,
  BookListResponse,
  BookReadingStatus,
  BookUpdateInput,
  CalendarEntry,
  CalendarEntryInput,
  CalendarEntryListResponse,
  CalendarEntryStatus,
  CalendarEntryUpdateInput,
  Checklist,
  ChecklistInput,
  ChecklistItem,
  ChecklistItemInput,
  ChecklistItemUpdateInput,
  ChecklistListResponse,
  ChecklistStatus,
  ChecklistUpdateInput,
  Countdown,
  CountdownInput,
  CountdownUpdateInput,
  CurrentSessionResponse,
  Course,
  CourseAssignment,
  CourseAssignmentInput,
  CourseAssignmentUpdateInput,
  CourseClassRecord,
  CourseClassRecordInput,
  CourseClassRecordUpdateInput,
  CourseInput,
  CourseListResponse,
  CourseStatus,
  CourseMaterial,
  CourseMaterialGroup,
  CourseUpdateInput,
  FeatureRuntimeState,
  FinanceAccount,
  FinanceAccountInput,
  FinanceAccountUpdateInput,
  FinanceDebtPlatform,
  FinanceDebtPlatformInput,
  FinanceDebtPlatformUpdateInput,
  FinanceDebtRecord,
  FinanceDebtRecordInput,
  FinanceSummary,
  Goal,
  GoalInput,
  GoalListResponse,
  GoalMeasurementInput,
  GoalStatus,
  GoalUpdateInput,
  InboxItem,
  InboxItemInput,
  InboxItemListResponse,
  InboxItemStatus,
  InboxItemUpdateInput,
  LoginInput,
  LoginResponse,
  LifeCountdownDashboard,
  LifeEvent,
  LifeEventInput,
  LifeEventUpdateInput,
  LifeProfile,
  LifeProfileInput,
  OverviewContributionDefinition,
  OverviewResponse,
  PaginatedCountdowns,
  QuickCreateActionDefinition,
  SearchResponse,
  SessionView,
  StoredFile,
  Subscription,
  SubscriptionInput,
  SubscriptionListResponse,
  SubscriptionStatus,
  SubscriptionUpdateInput,
  SystemStatus,
  Task,
  TaskCompletion,
  TaskInput,
  TaskListResponse,
  TaskStatus,
  TaskUpdateInput,
  TimetableAdjustment,
  TimetableAdjustmentInput,
  TimetableAdjustmentUpdateInput,
  TimetableCourse,
  TimetableCourseInput,
  TimetableCourseListResponse,
  TimetableCourseUpdateInput,
  TimetableEntityStatus,
  TimetableOccurrenceListResponse,
  TimetableSemester,
  TimetableSemesterInput,
  TimetableSemesterListResponse,
  TimetableSemesterUpdateInput,
  TimetableTimeBlocksUpdateInput,
  WorkbenchNotification,
  WorkbenchPreferences,
} from './types.js';
import { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_MEBIBYTES } from './constants.js';

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly requestId: string | undefined;
  public readonly details: unknown;

  public constructor(status: number, body?: Partial<ApiErrorBody>) {
    super(body?.error?.message ?? `请求失败（${status}）`);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = body?.error?.code ?? 'UNKNOWN_ERROR';
    this.requestId = body?.requestId;
    this.details = body?.error?.details;
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  csrf?: boolean;
};

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class WorkbenchClient {
  private readonly baseUrl: string;
  private csrfToken: string | undefined;
  private csrfPromise: Promise<string> | undefined;

  public constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async ensureCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    if (!this.csrfPromise) {
      this.csrfPromise = this.request<{ csrfToken: string }>('/auth/csrf', { csrf: false })
        .then((response) => {
          this.csrfToken = response.csrfToken;
          return response.csrfToken;
        })
        .finally(() => {
          this.csrfPromise = undefined;
        });
    }
    return this.csrfPromise;
  }

  private async request<T>(
    path: string,
    options: RequestOptions = {},
    canRetryCsrf = true,
  ): Promise<T> {
    const { body, csrf, ...requestOptions } = options;
    const method = (requestOptions.method ?? 'GET').toUpperCase();
    const headers = new Headers(requestOptions.headers);
    headers.set('Accept', 'application/json');

    if (body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    if (csrf !== false && MUTATION_METHODS.has(method)) {
      headers.set('X-CSRF-Token', await this.ensureCsrfToken());
    }

    const requestInit: RequestInit = {
      ...requestOptions,
      method,
      headers,
      credentials: 'same-origin',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    };
    const response = await fetch(`${this.baseUrl}${path}`, requestInit);

    if (!response.ok) {
      let body: Partial<ApiErrorBody> | undefined;
      try {
        body = (await response.json()) as Partial<ApiErrorBody>;
      } catch {
        body = undefined;
      }
      if (response.status === 401) this.clearCsrfToken();
      if (
        response.status === 403 &&
        body?.error?.code === 'CSRF_INVALID' &&
        csrf !== false &&
        MUTATION_METHODS.has(method) &&
        canRetryCsrf
      ) {
        this.clearCsrfToken();
        return this.request<T>(path, options, false);
      }
      throw new ApiClientError(response.status, body);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  public async getCsrfToken(): Promise<string> {
    this.clearCsrfToken();
    return this.ensureCsrfToken();
  }

  public getCurrentSession(): Promise<CurrentSessionResponse> {
    return this.request('/auth/session');
  }

  public async login(input: LoginInput): Promise<LoginResponse> {
    await this.ensureCsrfToken();
    return this.request('/auth/login', { method: 'POST', body: input });
  }

  public async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
    this.clearCsrfToken();
  }

  public listSessions(): Promise<SessionView[]> {
    return this.request('/auth/sessions');
  }

  public renameSession(sessionId: string, clientLabel: string): Promise<SessionView> {
    return this.request(`/auth/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      body: { clientLabel },
    });
  }

  public revokeSession(sessionId: string): Promise<void> {
    return this.request(`/auth/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
  }

  public logoutOtherSessions(): Promise<void> {
    return this.request('/auth/sessions/logout-others', { method: 'POST' });
  }

  public async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.request('/auth/password', {
      method: 'PUT',
      body: { currentPassword, newPassword },
    });
    this.clearCsrfToken();
  }

  public getFeatureStates(): Promise<FeatureRuntimeState[]> {
    return this.request('/workbench/features');
  }

  public getOverviewDefinitions(): Promise<OverviewContributionDefinition[]> {
    return this.request('/workbench/overview/definitions');
  }

  public getOverview(blockIds: string[]): Promise<OverviewResponse> {
    const query = new URLSearchParams();
    if (blockIds.length > 0) query.set('blockIds', blockIds.join(','));
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return this.request(`/workbench/overview${suffix}`);
  }

  public getPreferences(): Promise<WorkbenchPreferences> {
    return this.request('/workbench/preferences');
  }

  public updatePreferences(input: WorkbenchPreferences): Promise<WorkbenchPreferences> {
    return this.request('/workbench/preferences', { method: 'PUT', body: input });
  }

  public search(query: string): Promise<SearchResponse> {
    return this.request(`/workbench/search?query=${encodeURIComponent(query)}`);
  }

  public getQuickActions(): Promise<QuickCreateActionDefinition[]> {
    return this.request('/workbench/quick-actions');
  }

  public getNotifications(): Promise<WorkbenchNotification[]> {
    return this.request('/workbench/notifications');
  }

  public markNotificationRead(notificationId: string): Promise<void> {
    return this.request(`/workbench/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'PUT',
    });
  }

  public markAllNotificationsRead(): Promise<void> {
    return this.request('/workbench/notifications/read-all', { method: 'PUT' });
  }

  public getSystemStatus(): Promise<SystemStatus> {
    return this.request('/workbench/system-status');
  }

  public getCountdowns(
    options: {
      status?: 'active' | 'completed' | 'archived';
      cursor?: string;
      limit?: number;
    } = {},
  ): Promise<PaginatedCountdowns> {
    const query = new URLSearchParams();
    if (options.status) query.set('status', options.status);
    if (options.cursor) query.set('cursor', options.cursor);
    if (options.limit) query.set('limit', String(options.limit));
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return this.request(`/countdowns${suffix}`);
  }

  public getCountdown(id: string): Promise<Countdown> {
    return this.request(`/countdowns/${encodeURIComponent(id)}`);
  }

  public createCountdown(input: CountdownInput): Promise<Countdown> {
    return this.request('/countdowns', { method: 'POST', body: input });
  }

  public updateCountdown(id: string, input: CountdownUpdateInput): Promise<Countdown> {
    return this.request(`/countdowns/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: input,
    });
  }

  public archiveCountdown(id: string, version: number): Promise<void> {
    return this.request(`/countdowns/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: { version },
    });
  }

  public restoreCountdown(id: string, version: number): Promise<Countdown> {
    return this.request(`/countdowns/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      body: { version },
    });
  }

  public deleteCountdownPermanently(id: string, version: number): Promise<void> {
    return this.request(`/countdowns/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: { version },
    });
  }

  public async uploadFile(file: File, options: { signal?: AbortSignal } = {}): Promise<StoredFile> {
    if (file.size === 0) {
      throw new ApiClientError(400, {
        error: { code: 'EMPTY_FILE', message: '不能上传空文件。' },
      });
    }
    if (file.size > MAX_UPLOAD_FILE_BYTES) {
      throw new ApiClientError(413, {
        error: {
          code: 'FILE_TOO_LARGE',
          message: `单个文件不能超过 ${MAX_UPLOAD_FILE_MEBIBYTES} MB。`,
        },
      });
    }
    const form = new FormData();
    form.append('file', file, file.name);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(`${this.baseUrl}/files`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'X-CSRF-Token': await this.ensureCsrfToken(),
        },
        credentials: 'same-origin',
        body: form,
        ...(options.signal ? { signal: options.signal } : {}),
      });
      if (response.ok) return (await response.json()) as StoredFile;

      let body: Partial<ApiErrorBody> | undefined;
      try {
        body = (await response.json()) as Partial<ApiErrorBody>;
      } catch {
        body = undefined;
      }
      if (response.status === 401) this.clearCsrfToken();
      if (response.status === 403 && body?.error?.code === 'CSRF_INVALID' && attempt === 0) {
        this.clearCsrfToken();
        continue;
      }
      throw new ApiClientError(response.status, body);
    }
    throw new ApiClientError(403, {
      error: { code: 'CSRF_INVALID', message: 'CSRF 校验失败，请重试。' },
    });
  }

  private clearCsrfToken(): void {
    this.csrfToken = undefined;
    this.csrfPromise = undefined;
  }

  public getBooks(
    options: {
      archived?: boolean;
      readingStatus?: BookReadingStatus;
      limit?: number;
    } = {},
  ): Promise<BookListResponse> {
    const query = new URLSearchParams();
    if (options.archived !== undefined) query.set('archived', String(options.archived));
    if (options.readingStatus) query.set('readingStatus', options.readingStatus);
    if (options.limit) query.set('limit', String(options.limit));
    const suffix = query.size ? `?${query.toString()}` : '';
    return this.request(`/books${suffix}`);
  }

  public getBook(id: string): Promise<Book> {
    return this.request(`/books/${encodeURIComponent(id)}`);
  }

  public createBook(input: BookInput): Promise<Book> {
    return this.request('/books', { method: 'POST', body: input });
  }

  public updateBook(id: string, input: BookUpdateInput): Promise<Book> {
    return this.request(`/books/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
  }

  public archiveBook(id: string, version: number): Promise<void> {
    return this.request(`/books/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: { version },
    });
  }

  public restoreBook(id: string, version: number): Promise<Book> {
    return this.request(`/books/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      body: { version },
    });
  }

  public deleteBookPermanently(id: string, version: number): Promise<void> {
    return this.request(`/books/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: { version },
    });
  }

  public createBookChapter(bookId: string, input: BookChapterInput): Promise<BookChapter> {
    return this.request(`/books/${encodeURIComponent(bookId)}/chapters`, {
      method: 'POST',
      body: input,
    });
  }

  public getBookChapter(bookId: string, chapterId: string): Promise<BookChapter> {
    return this.request(
      `/books/${encodeURIComponent(bookId)}/chapters/${encodeURIComponent(chapterId)}`,
    );
  }

  public updateBookChapter(
    bookId: string,
    chapterId: string,
    input: BookChapterUpdateInput,
  ): Promise<BookChapter> {
    return this.request(
      `/books/${encodeURIComponent(bookId)}/chapters/${encodeURIComponent(chapterId)}`,
      { method: 'PUT', body: input },
    );
  }

  public deleteBookChapter(bookId: string, chapterId: string, version: number): Promise<void> {
    return this.request(
      `/books/${encodeURIComponent(bookId)}/chapters/${encodeURIComponent(chapterId)}`,
      { method: 'DELETE', body: { version } },
    );
  }

  public getCourses(
    options: { archived?: boolean; status?: CourseStatus; limit?: number } = {},
  ): Promise<CourseListResponse> {
    const query = new URLSearchParams();
    if (options.archived !== undefined) query.set('archived', String(options.archived));
    if (options.status) query.set('status', options.status);
    if (options.limit) query.set('limit', String(options.limit));
    const suffix = query.size ? `?${query.toString()}` : '';
    return this.request(`/courses${suffix}`);
  }

  public getCourse(id: string): Promise<Course> {
    return this.request(`/courses/${encodeURIComponent(id)}`);
  }

  public createCourse(input: CourseInput): Promise<Course> {
    return this.request('/courses', { method: 'POST', body: input });
  }

  public updateCourse(id: string, input: CourseUpdateInput): Promise<Course> {
    return this.request(`/courses/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
  }

  public archiveCourse(id: string, version: number): Promise<void> {
    return this.request(`/courses/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: { version },
    });
  }

  public restoreCourse(id: string, version: number): Promise<Course> {
    return this.request(`/courses/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      body: { version },
    });
  }

  public deleteCoursePermanently(id: string, version: number): Promise<void> {
    return this.request(`/courses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: { version },
    });
  }

  public createCourseClassRecord(
    courseId: string,
    input: CourseClassRecordInput,
  ): Promise<CourseClassRecord> {
    return this.request(`/courses/${encodeURIComponent(courseId)}/class-records`, {
      method: 'POST',
      body: input,
    });
  }

  public updateCourseClassRecord(
    courseId: string,
    recordId: string,
    input: CourseClassRecordUpdateInput,
  ): Promise<CourseClassRecord> {
    return this.request(
      `/courses/${encodeURIComponent(courseId)}/class-records/${encodeURIComponent(recordId)}`,
      { method: 'PUT', body: input },
    );
  }

  public deleteCourseClassRecord(
    courseId: string,
    recordId: string,
    version: number,
  ): Promise<void> {
    return this.request(
      `/courses/${encodeURIComponent(courseId)}/class-records/${encodeURIComponent(recordId)}`,
      { method: 'DELETE', body: { version } },
    );
  }

  public createCourseAssignment(
    courseId: string,
    input: CourseAssignmentInput,
  ): Promise<CourseAssignment> {
    return this.request(`/courses/${encodeURIComponent(courseId)}/assignments`, {
      method: 'POST',
      body: input,
    });
  }

  public updateCourseAssignment(
    courseId: string,
    assignmentId: string,
    input: CourseAssignmentUpdateInput,
  ): Promise<CourseAssignment> {
    return this.request(
      `/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}`,
      { method: 'PUT', body: input },
    );
  }

  public deleteCourseAssignment(
    courseId: string,
    assignmentId: string,
    version: number,
  ): Promise<void> {
    return this.request(
      `/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}`,
      { method: 'DELETE', body: { version } },
    );
  }

  public createCourseMaterialGroup(
    courseId: string,
    input: { name: string; position?: number },
  ): Promise<CourseMaterialGroup> {
    return this.request(`/courses/${encodeURIComponent(courseId)}/material-groups`, {
      method: 'POST',
      body: input,
    });
  }

  public deleteCourseMaterialGroup(
    courseId: string,
    groupId: string,
    version: number,
  ): Promise<void> {
    return this.request(
      `/courses/${encodeURIComponent(courseId)}/material-groups/${encodeURIComponent(groupId)}`,
      { method: 'DELETE', body: { version } },
    );
  }

  public createCourseMaterial(
    courseId: string,
    input: { fileId: string; groupId?: string | null; label?: string; position?: number },
  ): Promise<CourseMaterial> {
    return this.request(`/courses/${encodeURIComponent(courseId)}/materials`, {
      method: 'POST',
      body: input,
    });
  }

  public deleteCourseMaterial(
    courseId: string,
    materialId: string,
    version: number,
  ): Promise<void> {
    return this.request(
      `/courses/${encodeURIComponent(courseId)}/materials/${encodeURIComponent(materialId)}`,
      { method: 'DELETE', body: { version } },
    );
  }

  public getGoals(
    options: { status?: GoalStatus; limit?: number } = {},
  ): Promise<GoalListResponse> {
    const query = new URLSearchParams();
    if (options.status) query.set('status', options.status);
    if (options.limit) query.set('limit', String(options.limit));
    const suffix = query.size ? `?${query.toString()}` : '';
    return this.request(`/goals${suffix}`);
  }

  public getGoal(id: string): Promise<Goal> {
    return this.request(`/goals/${encodeURIComponent(id)}`);
  }

  public createGoal(input: GoalInput): Promise<Goal> {
    return this.request('/goals', { method: 'POST', body: input });
  }

  public updateGoal(id: string, input: GoalUpdateInput): Promise<Goal> {
    return this.request(`/goals/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
  }

  public addGoalMeasurement(id: string, input: GoalMeasurementInput): Promise<Goal> {
    return this.request(`/goals/${encodeURIComponent(id)}/measurements`, {
      method: 'POST',
      body: input,
    });
  }

  public archiveGoal(id: string, version: number): Promise<void> {
    return this.request(`/goals/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: { version },
    });
  }

  public restoreGoal(id: string, version: number): Promise<Goal> {
    return this.request(`/goals/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      body: { version },
    });
  }

  public deleteGoalPermanently(id: string, version: number): Promise<void> {
    return this.request(`/goals/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: { version },
    });
  }

  public getTasks(
    options: { status?: TaskStatus | 'open'; limit?: number } = {},
  ): Promise<TaskListResponse> {
    const query = new URLSearchParams();
    if (options.status) query.set('status', options.status);
    if (options.limit) query.set('limit', String(options.limit));
    const suffix = query.size ? `?${query.toString()}` : '';
    return this.request(`/tasks${suffix}`);
  }

  public getTask(id: string): Promise<Task> {
    return this.request(`/tasks/${encodeURIComponent(id)}`);
  }

  public createTask(input: TaskInput): Promise<Task> {
    return this.request('/tasks', { method: 'POST', body: input });
  }

  public updateTask(id: string, input: TaskUpdateInput): Promise<Task> {
    return this.request(`/tasks/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
  }

  public completeTask(id: string, version: number): Promise<TaskCompletion> {
    return this.request(`/tasks/${encodeURIComponent(id)}/complete`, {
      method: 'POST',
      body: { version },
    });
  }

  public archiveTask(id: string, version: number): Promise<void> {
    return this.request(`/tasks/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: { version },
    });
  }

  public restoreTask(id: string, version: number): Promise<Task> {
    return this.request(`/tasks/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      body: { version },
    });
  }

  public deleteTaskPermanently(id: string, version: number): Promise<void> {
    return this.request(`/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: { version },
    });
  }

  public getChecklists(
    options: { status?: ChecklistStatus; limit?: number } = {},
  ): Promise<ChecklistListResponse> {
    const query = new URLSearchParams();
    if (options.status) query.set('status', options.status);
    if (options.limit) query.set('limit', String(options.limit));
    const suffix = query.size ? `?${query.toString()}` : '';
    return this.request(`/checklists${suffix}`);
  }

  public getChecklist(id: string): Promise<Checklist> {
    return this.request(`/checklists/${encodeURIComponent(id)}`);
  }

  public createChecklist(input: ChecklistInput): Promise<Checklist> {
    return this.request('/checklists', { method: 'POST', body: input });
  }

  public updateChecklist(id: string, input: ChecklistUpdateInput): Promise<Checklist> {
    return this.request(`/checklists/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
  }

  public completeChecklist(id: string, version: number): Promise<Checklist> {
    return this.request(`/checklists/${encodeURIComponent(id)}/complete`, {
      method: 'POST',
      body: { version },
    });
  }

  public reopenChecklist(id: string, version: number): Promise<Checklist> {
    return this.request(`/checklists/${encodeURIComponent(id)}/reopen`, {
      method: 'POST',
      body: { version },
    });
  }

  public archiveChecklist(id: string, version: number): Promise<void> {
    return this.request(`/checklists/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: { version },
    });
  }

  public restoreChecklist(id: string, version: number): Promise<Checklist> {
    return this.request(`/checklists/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      body: { version },
    });
  }

  public deleteChecklistPermanently(id: string, version: number): Promise<void> {
    return this.request(`/checklists/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: { version },
    });
  }

  public createChecklistItem(
    checklistId: string,
    input: ChecklistItemInput,
  ): Promise<ChecklistItem> {
    return this.request(`/checklists/${encodeURIComponent(checklistId)}/items`, {
      method: 'POST',
      body: input,
    });
  }

  public updateChecklistItem(
    checklistId: string,
    itemId: string,
    input: ChecklistItemUpdateInput,
  ): Promise<ChecklistItem> {
    return this.request(
      `/checklists/${encodeURIComponent(checklistId)}/items/${encodeURIComponent(itemId)}`,
      { method: 'PUT', body: input },
    );
  }

  public checkChecklistItem(
    checklistId: string,
    itemId: string,
    checked: boolean,
    version: number,
  ): Promise<ChecklistItem> {
    return this.request(
      `/checklists/${encodeURIComponent(checklistId)}/items/${encodeURIComponent(itemId)}/check`,
      { method: 'POST', body: { checked, version } },
    );
  }

  public deleteChecklistItem(checklistId: string, itemId: string, version: number): Promise<void> {
    return this.request(
      `/checklists/${encodeURIComponent(checklistId)}/items/${encodeURIComponent(itemId)}`,
      { method: 'DELETE', body: { version } },
    );
  }

  public resetChecklist(id: string, version: number): Promise<Checklist> {
    return this.request(`/checklists/${encodeURIComponent(id)}/reset`, {
      method: 'POST',
      body: { version },
    });
  }

  public clearCheckedChecklistItems(id: string, version: number): Promise<Checklist> {
    return this.request(`/checklists/${encodeURIComponent(id)}/clear-checked`, {
      method: 'POST',
      body: { version },
    });
  }

  public getCalendarEntries(options: {
    from: string;
    to: string;
    status?: CalendarEntryStatus;
    limit?: number;
  }): Promise<CalendarEntryListResponse> {
    const query = new URLSearchParams({ from: options.from, to: options.to });
    if (options.status) query.set('status', options.status);
    if (options.limit) query.set('limit', String(options.limit));
    return this.request(`/calendar-entries?${query.toString()}`);
  }

  public getCalendarEntry(id: string): Promise<CalendarEntry> {
    return this.request(`/calendar-entries/${encodeURIComponent(id)}`);
  }
  public createCalendarEntry(input: CalendarEntryInput): Promise<CalendarEntry> {
    return this.request('/calendar-entries', { method: 'POST', body: input });
  }
  public updateCalendarEntry(id: string, input: CalendarEntryUpdateInput): Promise<CalendarEntry> {
    return this.request(`/calendar-entries/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: input,
    });
  }
  public archiveCalendarEntry(id: string, version: number): Promise<void> {
    return this.request(`/calendar-entries/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: { version },
    });
  }
  public restoreCalendarEntry(id: string, version: number): Promise<CalendarEntry> {
    return this.request(`/calendar-entries/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      body: { version },
    });
  }
  public deleteCalendarEntryPermanently(id: string, version: number): Promise<void> {
    return this.request(`/calendar-entries/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: { version },
    });
  }

  public getTimetableSemesters(
    status: TimetableEntityStatus = 'active',
  ): Promise<TimetableSemesterListResponse> {
    return this.request(`/timetable/semesters?status=${encodeURIComponent(status)}`);
  }
  public getTimetableSemester(id: string): Promise<TimetableSemester> {
    return this.request(`/timetable/semesters/${encodeURIComponent(id)}`);
  }
  public createTimetableSemester(input: TimetableSemesterInput): Promise<TimetableSemester> {
    return this.request('/timetable/semesters', { method: 'POST', body: input });
  }
  public updateTimetableSemester(
    id: string,
    input: TimetableSemesterUpdateInput,
  ): Promise<TimetableSemester> {
    return this.request(`/timetable/semesters/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: input,
    });
  }
  public updateTimetableTimeBlocks(
    semesterId: string,
    input: TimetableTimeBlocksUpdateInput,
  ): Promise<TimetableSemester> {
    return this.request(`/timetable/semesters/${encodeURIComponent(semesterId)}/time-blocks`, {
      method: 'PUT',
      body: input,
    });
  }
  public archiveTimetableSemester(id: string, version: number): Promise<void> {
    return this.request(`/timetable/semesters/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: { version },
    });
  }
  public restoreTimetableSemester(id: string, version: number): Promise<TimetableSemester> {
    return this.request(`/timetable/semesters/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      body: { version },
    });
  }
  public deleteTimetableSemesterPermanently(id: string, version: number): Promise<void> {
    return this.request(`/timetable/semesters/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: { version },
    });
  }
  public getTimetableCourses(
    semesterId: string,
    status: TimetableEntityStatus = 'active',
  ): Promise<TimetableCourseListResponse> {
    const query = new URLSearchParams({ semesterId, status });
    return this.request(`/timetable/courses?${query.toString()}`);
  }
  public getTimetableCourse(id: string): Promise<TimetableCourse> {
    return this.request(`/timetable/courses/${encodeURIComponent(id)}`);
  }
  public createTimetableCourse(input: TimetableCourseInput): Promise<TimetableCourse> {
    return this.request('/timetable/courses', { method: 'POST', body: input });
  }
  public updateTimetableCourse(
    id: string,
    input: TimetableCourseUpdateInput,
  ): Promise<TimetableCourse> {
    return this.request(`/timetable/courses/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: input,
    });
  }
  public archiveTimetableCourse(id: string, version: number): Promise<void> {
    return this.request(`/timetable/courses/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: { version },
    });
  }
  public restoreTimetableCourse(id: string, version: number): Promise<TimetableCourse> {
    return this.request(`/timetable/courses/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      body: { version },
    });
  }
  public deleteTimetableCoursePermanently(id: string, version: number): Promise<void> {
    return this.request(`/timetable/courses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: { version },
    });
  }
  public getTimetableOccurrences(
    week: number,
    semesterId?: string,
  ): Promise<TimetableOccurrenceListResponse> {
    const query = new URLSearchParams({ week: String(week) });
    if (semesterId) query.set('semesterId', semesterId);
    return this.request(`/timetable/occurrences?${query.toString()}`);
  }
  public createTimetableAdjustment(
    courseId: string,
    input: TimetableAdjustmentInput,
  ): Promise<TimetableAdjustment> {
    return this.request(`/timetable/courses/${encodeURIComponent(courseId)}/adjustments`, {
      method: 'POST',
      body: input,
    });
  }
  public updateTimetableAdjustment(
    id: string,
    input: TimetableAdjustmentUpdateInput,
  ): Promise<TimetableAdjustment> {
    return this.request(`/timetable/adjustments/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: input,
    });
  }
  public deleteTimetableAdjustment(id: string, version: number): Promise<void> {
    return this.request(`/timetable/adjustments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: { version },
    });
  }

  public getInboxItems(
    options: { status?: InboxItemStatus; limit?: number } = {},
  ): Promise<InboxItemListResponse> {
    const query = new URLSearchParams();
    if (options.status) query.set('status', options.status);
    if (options.limit) query.set('limit', String(options.limit));
    const suffix = query.size ? `?${query.toString()}` : '';
    return this.request(`/inbox-items${suffix}`);
  }

  public getInboxItem(id: string): Promise<InboxItem> {
    return this.request(`/inbox-items/${encodeURIComponent(id)}`);
  }
  public createInboxItem(input: InboxItemInput): Promise<InboxItem> {
    return this.request('/inbox-items', { method: 'POST', body: input });
  }
  public updateInboxItem(id: string, input: InboxItemUpdateInput): Promise<InboxItem> {
    return this.request(`/inbox-items/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
  }
  public archiveInboxItem(id: string, version: number): Promise<void> {
    return this.request(`/inbox-items/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: { version },
    });
  }
  public restoreInboxItem(id: string, version: number): Promise<InboxItem> {
    return this.request(`/inbox-items/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      body: { version },
    });
  }
  public deleteInboxItemPermanently(id: string, version: number): Promise<void> {
    return this.request(`/inbox-items/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: { version },
    });
  }

  public getSubscriptions(
    options: { status?: SubscriptionStatus; limit?: number } = {},
  ): Promise<SubscriptionListResponse> {
    const query = new URLSearchParams();
    if (options.status) query.set('status', options.status);
    if (options.limit) query.set('limit', String(options.limit));
    const suffix = query.size ? `?${query.toString()}` : '';
    return this.request(`/subscriptions${suffix}`);
  }
  public getSubscription(id: string): Promise<Subscription> {
    return this.request(`/subscriptions/${encodeURIComponent(id)}`);
  }
  public createSubscription(input: SubscriptionInput): Promise<Subscription> {
    return this.request('/subscriptions', { method: 'POST', body: input });
  }
  public updateSubscription(id: string, input: SubscriptionUpdateInput): Promise<Subscription> {
    return this.request(`/subscriptions/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
  }
  public archiveSubscription(id: string, version: number): Promise<void> {
    return this.request(`/subscriptions/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: { version },
    });
  }
  public restoreSubscription(id: string, version: number): Promise<Subscription> {
    return this.request(`/subscriptions/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      body: { version },
    });
  }
  public deleteSubscriptionPermanently(id: string, version: number): Promise<void> {
    return this.request(`/subscriptions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: { version },
    });
  }

  public getFinanceSummary(year: number, month: number): Promise<FinanceSummary> {
    return this.request(`/finance/summary?year=${year}&month=${month}`);
  }
  public getFinanceAccounts(archived = false): Promise<{ items: FinanceAccount[] }> {
    return this.request(`/finance/accounts?archived=${String(archived)}`);
  }
  public createFinanceAccount(input: FinanceAccountInput): Promise<FinanceAccount> {
    return this.request('/finance/accounts', { method: 'POST', body: input });
  }
  public updateFinanceAccount(
    id: string,
    input: FinanceAccountUpdateInput,
  ): Promise<FinanceAccount> {
    return this.request(`/finance/accounts/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: input,
    });
  }
  public archiveFinanceAccount(id: string, version: number): Promise<void> {
    return this.request(`/finance/accounts/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: { version },
    });
  }
  public restoreFinanceAccount(id: string, version: number): Promise<FinanceAccount> {
    return this.request(`/finance/accounts/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      body: { version },
    });
  }
  public deleteFinanceAccountPermanently(id: string, version: number): Promise<void> {
    return this.request(`/finance/accounts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: { version },
    });
  }
  public getFinanceDebtPlatforms(archived = false): Promise<{ items: FinanceDebtPlatform[] }> {
    return this.request(`/finance/debt-platforms?archived=${String(archived)}`);
  }
  public createFinanceDebtPlatform(input: FinanceDebtPlatformInput): Promise<FinanceDebtPlatform> {
    return this.request('/finance/debt-platforms', { method: 'POST', body: input });
  }
  public updateFinanceDebtPlatform(
    id: string,
    input: FinanceDebtPlatformUpdateInput,
  ): Promise<FinanceDebtPlatform> {
    return this.request(`/finance/debt-platforms/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: input,
    });
  }
  public archiveFinanceDebtPlatform(id: string, version: number): Promise<void> {
    return this.request(`/finance/debt-platforms/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: { version },
    });
  }
  public restoreFinanceDebtPlatform(id: string, version: number): Promise<FinanceDebtPlatform> {
    return this.request(`/finance/debt-platforms/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      body: { version },
    });
  }
  public deleteFinanceDebtPlatformPermanently(id: string, version: number): Promise<void> {
    return this.request(`/finance/debt-platforms/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: { version },
    });
  }
  public upsertFinanceDebtRecord(input: FinanceDebtRecordInput): Promise<FinanceDebtRecord> {
    return this.request('/finance/debt-records', { method: 'PUT', body: input });
  }
  public deleteFinanceDebtRecord(id: string, version: number): Promise<void> {
    return this.request(`/finance/debt-records/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: { version },
    });
  }

  public getLifeCountdown(
    status: 'active' | 'archived' = 'active',
  ): Promise<LifeCountdownDashboard> {
    return this.request(`/life-countdown?status=${status}`);
  }
  public updateLifeProfile(input: LifeProfileInput): Promise<LifeProfile> {
    return this.request('/life-countdown/profile', { method: 'PUT', body: input });
  }
  public createLifeEvent(input: LifeEventInput): Promise<LifeEvent> {
    return this.request('/life-countdown/events', { method: 'POST', body: input });
  }
  public updateLifeEvent(id: string, input: LifeEventUpdateInput): Promise<LifeEvent> {
    return this.request(`/life-countdown/events/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: input,
    });
  }
  public archiveLifeEvent(id: string, version: number): Promise<void> {
    return this.request(`/life-countdown/events/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: { version },
    });
  }
  public restoreLifeEvent(id: string, version: number): Promise<LifeEvent> {
    return this.request(`/life-countdown/events/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      body: { version },
    });
  }
  public deleteLifeEventPermanently(id: string, version: number): Promise<void> {
    return this.request(`/life-countdown/events/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: { version },
    });
  }
}
