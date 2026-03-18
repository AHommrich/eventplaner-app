import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import api, { registerDrinksBlockedHandler, clearDrinksBlockedHandler, resetDrinksBlocked } from './api';

type BlockedFeaturesContextType = {
  drinksBlocked: boolean;
};

const BlockedFeaturesContext = createContext<BlockedFeaturesContextType>({ drinksBlocked: false });

const POLL_INTERVAL_MS = 10_000;

export function BlockedFeaturesProvider({ children }: { children: React.ReactNode }) {
  const [drinksBlocked, setDrinksBlocked] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(() => {
      api.get('/api/drinks').then(() => {
        resetDrinksBlocked();
        setDrinksBlocked(false);
        stopPolling();
      }).catch(() => {});
    }, POLL_INTERVAL_MS);
  }

  useEffect(() => {
    registerDrinksBlockedHandler(() => {
      setDrinksBlocked(true);
      startPolling();
    });
    // Initial-Probe
    api.get('/api/drinks').catch(() => {});
    return () => {
      clearDrinksBlockedHandler();
      stopPolling();
    };
  }, []);

  return (
    <BlockedFeaturesContext.Provider value={{ drinksBlocked }}>
      {children}
    </BlockedFeaturesContext.Provider>
  );
}

export function useBlockedFeatures() {
  return useContext(BlockedFeaturesContext);
}
