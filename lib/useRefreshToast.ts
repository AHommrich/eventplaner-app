import { useEffect, useRef, useState } from 'react';

/**
 * Pull-to-refresh helper that also flashes a confirmation toast.
 *
 * The consumer only sees three pieces of state: `refreshing` (spinner still
 * spinning), `refreshed` (spinner just finished, show the "Aktualisiert" toast
 * for a short window), and `onRefresh` (the callback wired to
 * `RefreshControl`). The double-state exists because a single boolean would
 * hide the toast the moment the spinner disappears — the toast needs a
 * lifetime of its own so the guest actually notices it.
 *
 * The two-second lifetime is deliberately short: long enough to read, short
 * enough that repeated pulls don't stack toasts.
 *
 * @param loadFn — async data-reload the screen wants to run on pull.
 * @returns `{ refreshing, refreshed, onRefresh }` for `<RefreshControl>` and
 *          `<RefreshToast>`.
 */
export function useRefreshToast(loadFn: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function onRefresh() {
    setRefreshing(true);
    await loadFn();
    setRefreshing(false);
    setRefreshed(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setRefreshed(false), 2000);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { refreshing, refreshed, onRefresh };
}
