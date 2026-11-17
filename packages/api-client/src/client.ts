import type {
  AdminUserDetail,
  AdminUserSummary,
  AuditLogEntry,
  AuthSuccessResponse,
  AuthTokens,
  ClientType,
  CurrentUser,
  HealthResponse,
  LoginResponse,
  Paginated,
  ProvidersResponse,
  SessionSummary,
  TotpSetupResponse,
} from '@musicverse/types';
import type {
  AdminGrantRoleInput,
  AdminListUsersQuery,
  AdminSuspendInput,
  AuditLogQuery,
  CapabilityInput,
  ChangePasswordInput,
  DeleteAccountInput,
  ForgotPasswordInput,
  LoginInput,
  MfaVerifyInput,
  OAuthSignInInput,
  RegisterInput,
  ResetPasswordInput,
  TotpConfirmInput,
  TotpDisableInput,
  UpdatePreferencesInput,
  UpdateProfileInput,
} from '@musicverse/validation';
import { ApiError } from './errors';

/**
 * Where tokens live is platform specific:
 * - web/admin: access token in memory, refresh token in an HttpOnly cookie (`refreshMode: 'cookie'`)
 * - mobile: both in the OS keychain via SecureStore (`refreshMode: 'body'`)
 */
export interface TokenStore {
  getAccessToken(): string | null | Promise<string | null>;
  getRefreshToken?(): string | null | Promise<string | null>;
  setTokens(tokens: AuthTokens): void | Promise<void>;
  clear(): void | Promise<void>;
}

export interface ApiClientOptions {
  /** Origin + prefix, e.g. `https://api.musicverse.app/api/v1` or `/api/v1`. */
  baseUrl: string;
  clientType: ClientType;
  tokenStore: TokenStore;
  refreshMode: 'cookie' | 'body';
  fetch?: typeof fetch;
  /** Called when refresh fails and the user must sign in again. */
  onSessionExpired?: () => void;
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  /** Skip the bearer token (public endpoints). */
  anonymous?: boolean;
  /** Send credentials (cookies) — needed for refresh/logout on web. */
  withCredentials?: boolean;
  /** Retry once after refreshing when a 401 is returned. Default true for authenticated calls. */
  retryOnUnauthorized?: boolean;
  headers?: Record<string, string>;
}

function buildQuery(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export class ApiClient {
  private readonly fetchImpl: typeof fetch;
  private refreshInFlight: Promise<boolean> | null = null;

  constructor(private readonly options: ApiClientOptions) {
    this.fetchImpl = options.fetch ?? ((...args) => globalThis.fetch(...args));
  }

  // ---------------------------------------------------------------- core

  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const { anonymous = false } = opts;
    const retry = opts.retryOnUnauthorized ?? !anonymous;
    const response = await this.send(path, opts);

    if (response.status === 401 && retry) {
      const refreshed = await this.refreshTokens();
      if (refreshed) {
        const second = await this.send(path, opts);
        return this.parse<T>(second);
      }
      this.options.onSessionExpired?.();
    }
    return this.parse<T>(response);
  }

  private async send(path: string, opts: RequestOptions): Promise<Response> {
    const headers: Record<string, string> = { accept: 'application/json', ...opts.headers };
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    if (!opts.anonymous) {
      const token = await this.options.tokenStore.getAccessToken();
      if (token) headers.authorization = `Bearer ${token}`;
    }
    if (opts.withCredentials) headers['x-csrf-protection'] = '1';

    try {
      return await this.fetchImpl(`${this.options.baseUrl}${path}${buildQuery(opts.query)}`, {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        credentials: opts.withCredentials ? 'include' : 'same-origin',
      });
    } catch (error) {
      throw new ApiError({
        code: 'NETWORK_ERROR',
        status: 0,
        message: 'Unable to reach MusicVerse. Check your connection and try again.',
        details: { cause: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  private async parse<T>(response: Response): Promise<T> {
    if (!response.ok) throw await ApiError.fromResponse(response);
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  /**
   * Rotate the refresh token. Concurrent callers share a single in-flight refresh so a burst of
   * 401s does not trigger refresh-token reuse detection on the server.
   */
  refreshTokens(): Promise<boolean> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.doRefresh().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  private async doRefresh(): Promise<boolean> {
    const { tokenStore, refreshMode, clientType } = this.options;
    let body: { clientType: ClientType; refreshToken?: string } = { clientType };
    if (refreshMode === 'body') {
      const refreshToken = await tokenStore.getRefreshToken?.();
      if (!refreshToken) return false;
      body = { ...body, refreshToken };
    }
    try {
      const tokens = await this.request<AuthTokens>('/auth/refresh', {
        method: 'POST',
        body,
        anonymous: true,
        withCredentials: refreshMode === 'cookie',
        retryOnUnauthorized: false,
      });
      await tokenStore.setTokens(tokens);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status !== 0) await tokenStore.clear();
      return false;
    }
  }

  private async storeAuth<T extends LoginResponse | AuthSuccessResponse>(result: T): Promise<T> {
    if (!result.mfaRequired) await this.options.tokenStore.setTokens(result);
    return result;
  }

  // ---------------------------------------------------------------- endpoints

  readonly health = {
    ready: () => this.request<HealthResponse>('/health/ready', { anonymous: true }),
  };

  readonly auth = {
    providers: () => this.request<ProvidersResponse>('/auth/providers', { anonymous: true }),

    register: async (input: Omit<RegisterInput, 'clientType'>) =>
      this.storeAuth(
        await this.request<AuthSuccessResponse>('/auth/register', {
          method: 'POST',
          body: { ...input, clientType: this.options.clientType },
          anonymous: true,
          withCredentials: this.options.refreshMode === 'cookie',
        }),
      ),

    login: async (input: Omit<LoginInput, 'clientType'>) =>
      this.storeAuth(
        await this.request<LoginResponse>('/auth/login', {
          method: 'POST',
          body: { ...input, clientType: this.options.clientType },
          anonymous: true,
          withCredentials: this.options.refreshMode === 'cookie',
        }),
      ),

    verifyMfa: async (input: Omit<MfaVerifyInput, 'clientType'>) =>
      this.storeAuth(
        await this.request<AuthSuccessResponse>('/auth/mfa/verify', {
          method: 'POST',
          body: { ...input, clientType: this.options.clientType },
          anonymous: true,
          withCredentials: this.options.refreshMode === 'cookie',
        }),
      ),

    oauth: async (provider: 'google' | 'apple', input: Omit<OAuthSignInInput, 'clientType'>) =>
      this.storeAuth(
        await this.request<AuthSuccessResponse>(`/auth/oauth/${provider}`, {
          method: 'POST',
          body: { ...input, clientType: this.options.clientType },
          anonymous: true,
          withCredentials: this.options.refreshMode === 'cookie',
        }),
      ),

    refresh: () => this.refreshTokens(),

    logout: async () => {
      const refreshToken =
        this.options.refreshMode === 'body'
          ? ((await this.options.tokenStore.getRefreshToken?.()) ?? undefined)
          : undefined;
      try {
        await this.request<void>('/auth/logout', {
          method: 'POST',
          body: refreshToken ? { refreshToken } : {},
          anonymous: true,
          withCredentials: this.options.refreshMode === 'cookie',
          retryOnUnauthorized: false,
        });
      } finally {
        await this.options.tokenStore.clear();
      }
    },

    verifyEmail: (token: string) =>
      this.request<{ verified: true }>('/auth/email/verify', {
        method: 'POST',
        body: { token },
        anonymous: true,
      }),

    resendVerification: () =>
      this.request<{ sent: boolean }>('/auth/email/resend', { method: 'POST', body: {} }),

    forgotPassword: (input: ForgotPasswordInput) =>
      this.request<{ accepted: true }>('/auth/password/forgot', {
        method: 'POST',
        body: input,
        anonymous: true,
      }),

    resetPassword: (input: ResetPasswordInput) =>
      this.request<{ reset: true }>('/auth/password/reset', {
        method: 'POST',
        body: input,
        anonymous: true,
      }),

    changePassword: (input: ChangePasswordInput) =>
      this.request<{ changed: true }>('/auth/password/change', { method: 'POST', body: input }),

    sessions: () => this.request<SessionSummary[]>('/auth/sessions'),

    revokeSession: (id: string) =>
      this.request<void>(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),

    totpSetup: () =>
      this.request<TotpSetupResponse>('/auth/mfa/totp/setup', { method: 'POST', body: {} }),

    totpConfirm: (input: TotpConfirmInput) =>
      this.request<{ enabled: true }>('/auth/mfa/totp/confirm', { method: 'POST', body: input }),

    totpDisable: (input: TotpDisableInput) =>
      this.request<{ enabled: false }>('/auth/mfa/totp/disable', { method: 'POST', body: input }),
  };

  readonly users = {
    me: () => this.request<CurrentUser>('/users/me'),
    updateProfile: (input: UpdateProfileInput) =>
      this.request<CurrentUser>('/users/me/profile', { method: 'PATCH', body: input }),
    updatePreferences: (input: UpdatePreferencesInput) =>
      this.request<CurrentUser>('/users/me/preferences', { method: 'PATCH', body: input }),
    addCapability: (input: CapabilityInput) =>
      this.request<CurrentUser>('/users/me/capabilities', { method: 'POST', body: input }),
    removeCapability: (role: CapabilityInput['role']) =>
      this.request<CurrentUser>(`/users/me/capabilities/${role}`, { method: 'DELETE' }),
    deleteAccount: async (input: DeleteAccountInput) => {
      await this.request<void>('/users/me', { method: 'DELETE', body: input });
      await this.options.tokenStore.clear();
    },
  };

  readonly admin = {
    listUsers: (query: Partial<AdminListUsersQuery> = {}) =>
      this.request<Paginated<AdminUserSummary>>('/admin/users', { query }),
    getUser: (id: string) => this.request<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`),
    grantRole: (id: string, input: AdminGrantRoleInput) =>
      this.request<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}/roles`, {
        method: 'POST',
        body: input,
      }),
    revokeRole: (id: string, role: string) =>
      this.request<AdminUserDetail>(
        `/admin/users/${encodeURIComponent(id)}/roles/${encodeURIComponent(role)}`,
        { method: 'DELETE' },
      ),
    suspend: (id: string, input: AdminSuspendInput) =>
      this.request<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}/suspend`, {
        method: 'POST',
        body: input,
      }),
    reinstate: (id: string) =>
      this.request<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}/reinstate`, {
        method: 'POST',
        body: {},
      }),
    auditLogs: (query: Partial<AuditLogQuery> = {}) =>
      this.request<Paginated<AuditLogEntry>>('/admin/audit-logs', { query }),
  };
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  return new ApiClient(options);
}

/** Simple in-memory token store (web access tokens must never be persisted to localStorage). */
export function createMemoryTokenStore(): TokenStore & { snapshot(): AuthTokens | null } {
  let tokens: AuthTokens | null = null;
  return {
    getAccessToken: () => tokens?.accessToken ?? null,
    getRefreshToken: () => tokens?.refreshToken ?? null,
    setTokens: (next) => {
      tokens = { ...tokens, ...next };
    },
    clear: () => {
      tokens = null;
    },
    snapshot: () => tokens,
  };
}
