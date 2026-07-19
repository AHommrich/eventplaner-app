/**
 * Central axios client for every backend call.
 *
 * Two interceptors do the heavy lifting:
 *
 *   1. Request interceptor — attaches the bearer token (if any) and the
 *      currently-active language as `Accept-Language`. Fetched from
 *      `expo-secure-store` on every request so a mid-session language switch
 *      or logout is reflected on the very next call, without threading state
 *      through every caller.
 *
 *   2. Response interceptor — turns two backend-defined "soft blocks" into
 *      global side effects instead of per-caller error handling:
 *        - `app_blocked` (403): the whole app is disabled for this event;
 *          navigate to `/blocked` exactly once and swallow the rejection so
 *          no downstream `.catch()` ever surfaces an Alert. The module-level
 *          `_blocked` flag debounces repeated 403s during the polling loop.
 *        - `drinks_blocked`: only the drinks feature is off; notify the
 *          `BlockedFeaturesContext` (which polls for re-enable) and swallow
 *          the rejection so the calling screen renders its own placeholder
 *          without an alert.
 *        - authenticated 401: the backend no longer accepts the bearer token;
 *          clear the local session and navigate back to `/`.
 *
 * All other errors bubble up to the caller unchanged.
 */
import axios from 'axios';
import { router } from 'expo-router';
import { API_BASE } from '../constants/env';
import { getCached } from './sessionCache';
import { deleteGuestSession, deleteManagementSession } from './sessionStorage';

// `axios.create` is the officially blessed factory for a custom instance.
// The named `create` re-export exists too, but the `axios.<method>` shape
// keeps the call site consistent with `axios.get`/`axios.post`.
// eslint-disable-next-line import/no-named-as-default-member
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Management reads whose event is resolved server-side from the PAT — these
// must NOT carry an X-Event-ID header. Hoisted to module scope so it is not
// re-allocated on every single request.
const EVENT_HEADER_EXEMPT = new Set([
  '/api/management/me',
  '/api/management/me/events',
  '/api/management/push/register',
]);

/** Resolve the single bearer token appropriate for the request's audience. */
async function resolveBearer(isManagement: boolean, isLogout: boolean): Promise<string | null> {
  if (isManagement) return getCached('management_token');
  if (!isLogout) return getCached('guest_token');
  // Logout may target either audience; prefer the organizer session. This is
  // the one rare path that legitimately reads two keys.
  return (await getCached('management_token')) ?? (await getCached('guest_token'));
}

// --- Request interceptor: bearer token + language ---
api.interceptors.request.use(async (config) => {
  const path = config.url?.split('?')[0];
  const isManagement = config.url?.startsWith('/api/management/') ?? false;
  const isLogout = config.url === '/api/auth/logout';
  const needsEventHeader = isManagement && !EVENT_HEADER_EXEMPT.has(path ?? '');

  // Read ONLY the credentials this request needs, via the in-memory session
  // cache. After bootstrap `primeFromStore()` these are memory hits — no
  // keychain round-trip per request (Checkpoint 1).
  const [token, activeEventId, language] = await Promise.all([
    resolveBearer(isManagement, isLogout),
    needsEventHeader ? getCached('management_active_event_id') : Promise.resolve(null),
    getCached('app_language'),
  ]);

  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (needsEventHeader && activeEventId) {
    config.headers['X-Event-ID'] = activeEventId;
  }
  config.headers['Accept-Language'] = language ?? 'de';
  return config;
});

// --- Global block state (module-scoped so the debounce survives re-renders) ---
let _blocked = false;
let _drinksBlocked = false;
let _drinksBlockedHandler: (() => void) | null = null;
let _unauthorized = false;

function requestHadAuthorization(error: any) {
  const headers = error.config?.headers;
  return Boolean(headers?.Authorization ?? headers?.authorization);
}

function isLogoutRequest(error: any) {
  return error.config?.url === '/api/auth/logout';
}

/**
 * Rejection for a response the interceptor already fully handled with a global
 * side effect (app-blocked redirect, drinks-block handler, session-expiry
 * cleanup + redirect). Unlike the old never-resolving swallow, this ALWAYS
 * settles the promise so a TanStack Query `queryFn` can never hang forever.
 * Direct callers and query functions must ignore it via `isHandledApiError`
 * so they don't surface a duplicate Alert on top of the global effect.
 */
export class HandledApiError extends Error {
  readonly handled = true;

  constructor(public readonly kind: 'app_blocked' | 'drinks_blocked' | 'unauthorized') {
    super(`Handled API error: ${kind}`);
    this.name = 'HandledApiError';
  }
}

/** True for a rejection the interceptor already handled globally — never alert on it. */
export function isHandledApiError(error: unknown): boolean {
  return (
    error instanceof HandledApiError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { handled?: unknown }).handled === true)
  );
}

// --- Response interceptor: swallow app_blocked and drinks_blocked ---
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.data?.code;
    if (error.response?.status === 403 && code === 'app_blocked') {
      if (!_blocked) {
        _blocked = true;
        router.replace('/blocked');
      }
      // Reject with a handled marker (not a never-resolving promise) so a query
      // settles instead of hanging; callers ignore it via `isHandledApiError`.
      return Promise.reject(new HandledApiError('app_blocked'));
    }
    if (code === 'drinks_blocked') {
      if (!_drinksBlocked) {
        _drinksBlocked = true;
        _drinksBlockedHandler?.();
      }
      return Promise.reject(new HandledApiError('drinks_blocked'));
    }
    if (
      error.response?.status === 401 &&
      requestHadAuthorization(error) &&
      !isLogoutRequest(error)
    ) {
      if (!_unauthorized) {
        _unauthorized = true;
        const managementRequest = error.config?.url?.startsWith('/api/management/') ?? false;
        const cleanup = managementRequest ? deleteManagementSession() : deleteGuestSession();
        cleanup
          // Session expiry is a teardown too: purge the on-disk + in-memory
          // query cache so no personal data survives an involuntary logout
          // (same GDPR contract as the explicit logout/erasure paths). Lazy
          // require avoids the api → queryPersistence → queryClient → api cycle.
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          .then(() => require('./queryPersistence').purgePersistedCache())
          .catch(() => {})
          .finally(() => {
            router.replace('/');
          });
      }
      return Promise.reject(new HandledApiError('unauthorized'));
    }
    return Promise.reject(error);
  }
);

// --- Block-state controls (consumed by `blocked.tsx` and BlockedFeaturesContext) ---

/**
 * Reset the `app_blocked` guard so the redirect to `/blocked` can fire again
 * on the next 403. Called by `blocked.tsx` when its polling detects that the
 * app has been re-enabled.
 */
export function clearBlocked() {
  _blocked = false;
}

/**
 * Register the callback that `BlockedFeaturesContext` uses to react to a
 * `drinks_blocked` response. Only one handler at a time — the provider
 * unmount clears it via `clearDrinksBlockedHandler`.
 */
export function registerDrinksBlockedHandler(fn: () => void) {
  _drinksBlockedHandler = fn;
}

/** Detach the handler on provider unmount and reset the flag. */
export function clearDrinksBlockedHandler() {
  _drinksBlockedHandler = null;
  _drinksBlocked = false;
}

/**
 * Reset the drinks-block flag so a re-enable poll can fire the handler again
 * without waiting for a fresh `drinks_blocked` response.
 */
export function resetDrinksBlocked() {
  _drinksBlocked = false;
}

/** Reset the auth-expired debounce after a new login writes a fresh token. */
export function resetUnauthorizedRedirect() {
  _unauthorized = false;
}

export default api;
