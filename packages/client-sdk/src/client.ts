import type {
  ApiErrorBody,
  Countdown,
  CountdownInput,
  CountdownUpdateInput,
  CurrentSessionResponse,
  FeatureRuntimeState,
  LoginInput,
  LoginResponse,
  OverviewContributionDefinition,
  OverviewResponse,
  PaginatedCountdowns,
  QuickCreateActionDefinition,
  SearchResponse,
  SessionView,
  SystemStatus,
  WorkbenchNotification,
  WorkbenchPreferences,
} from './types.js';

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

  public constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async ensureCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    const response = await this.request<{ csrfToken: string }>('/auth/csrf', { csrf: false });
    this.csrfToken = response.csrfToken;
    return response.csrfToken;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
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
      if (response.status === 401) this.csrfToken = undefined;
      throw new ApiClientError(response.status, body);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  public async getCsrfToken(): Promise<string> {
    this.csrfToken = undefined;
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
    this.csrfToken = undefined;
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
    this.csrfToken = undefined;
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
    return this.request(`/countdowns/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: { version },
    });
  }
}
