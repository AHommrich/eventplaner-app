import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

type Refetchable = { isStale: boolean; refetch: () => Promise<unknown> };

/**
 * Refetch a query when the tab regains focus, but ONLY when the query is stale
 * (older than its `staleTime`). This is the correct "revalidate on focus"
 * behaviour: returning to a tab within `staleTime` shows the cached data with
 * no request; beyond it, a single background refresh runs. Calling `refetch()`
 * unconditionally on every focus (the naive version) bypasses `staleTime` and
 * re-introduces the "fetch on every tab switch" problem.
 *
 * `enabled` mirrors the query's own `enabled` gate: when the query is disabled
 * (e.g. no session/scope yet) we must NOT refetch, because `refetch()` bypasses
 * `enabled` and would fire a request the screen is about to redirect away from.
 *
 * A ref holds the latest query object + enabled flag so the focus callback
 * reads the current `isStale`/`refetch` (TanStack returns a fresh result object
 * each render); capturing once in the effect closure would read a stale flag.
 */
export function useRefetchOnFocus(query: Refetchable, enabled = true): void {
  const ref = useRef({ query, enabled });
  // Keep the ref current in a commit effect (not during render) so the focus
  // callback below reads the latest query without a render-time ref write.
  useEffect(() => {
    ref.current = { query, enabled };
  });

  useFocusEffect(
    useCallback(() => {
      if (ref.current.enabled && ref.current.query.isStale) void ref.current.query.refetch();
    }, [])
  );
}
