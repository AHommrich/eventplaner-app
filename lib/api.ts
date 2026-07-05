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
 *
 * All other errors bubble up to the caller unchanged.
 */
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { API_BASE } from '../constants/env';

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

// --- Request interceptor: bearer token + language ---
api.interceptors.request.use(async (config) => {
  const [token, language] = await Promise.all([
    SecureStore.getItemAsync('guest_token'),
    SecureStore.getItemAsync('app_language'),
  ]);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['Accept-Language'] = language ?? 'de';
  return config;
});

// --- Global block state (module-scoped so the debounce survives re-renders) ---
let _blocked = false;
let _drinksBlocked = false;
let _drinksBlockedHandler: (() => void) | null = null;

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
      // Returning a never-resolving promise swallows the rejection so no
      // downstream `.catch()` surfaces a duplicate Alert.
      return new Promise(() => {});
    }
    if (code === 'drinks_blocked') {
      if (!_drinksBlocked) {
        _drinksBlocked = true;
        _drinksBlockedHandler?.();
      }
      return new Promise(() => {}); // same swallow-strategy as above
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

export default api;
