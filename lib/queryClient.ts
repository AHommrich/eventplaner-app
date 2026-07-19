/**
 * Shared TanStack Query client (Checkpoint 2).
 *
 * Retry policy is deliberate: a globally-handled error (`HandledApiError`) or a
 * definitive client error (401/403/404/422) must never retry — retrying an
 * expired session or a blocked app just wastes requests. Transient failures
 * (network / 5xx / 429) get a small bounded retry.
 *
 * React Native has no window-focus event, so `focusManager` is driven off
 * `AppState`, and connectivity is driven off NetInfo into `onlineManager` so
 * queries pause offline and refetch on reconnect instead of burning retries.
 */
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { isHandledApiError } from './api';

focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    handleFocus(status === 'active');
  });
  return () => subscription.remove();
});

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(Boolean(state.isConnected));
  });
});

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

/**
 * Query retry policy. Exported so it can be unit-tested directly: the shared
 * `queryClient` singleton has its options overridden per test in
 * `tests/setupAfterEnv.ts`, so the predicate is otherwise unreachable from tests.
 *
 * A globally-handled error (`HandledApiError`) or a definitive client error
 * (4xx except 408/429) must never retry; transient failures (network / 5xx /
 * 408 / 429) get a small bounded retry.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isHandledApiError(error)) return false;
  const status = statusOf(error);
  // Never retry a definitive client error; only 408/429 are retryable 4xx.
  if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return false;
  }
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: shouldRetryQuery,
    },
    mutations: {
      retry: false,
    },
  },
});
