/**
 * Reactive session scope (Checkpoint 1).
 *
 * `lib/sessionCache.ts` is a module-level store — mutating it does NOT re-render
 * React on its own. This hook bridges it into the render tree via
 * `useSyncExternalStore`, so the always-mounted theme/query layers learn about
 * a login, logout, or event switch the moment the cache publishes a new scope.
 *
 * The scope is a non-secret `QueryScope` used to key the query cache; it is
 * `null` when no session is active. Consumers must derive scope from here,
 * never from a raw `sessionCache` read, so they stay reactive.
 */
import { useSyncExternalStore } from 'react';
import { getScope, subscribe, type QueryScope } from './sessionCache';

/** Current session scope, or `null` when signed out. Re-renders on change. */
export function useSessionScope(): QueryScope | null {
  return useSyncExternalStore(subscribe, getScope, getScope);
}
