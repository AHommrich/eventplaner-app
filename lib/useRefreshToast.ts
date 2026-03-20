import { useEffect, useRef, useState } from 'react';

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
