/**
 * Global "drinks feature is off right now" state.
 *
 * The backend hands out a `drinks_blocked` response code on demand — for
 * example, when the couple flips the drink-game off during the reception.
 * This provider owns the state so every screen (tab bar, drinks screen, home
 * hints) can react without every screen calling `/api/drinks` on its own.
 *
 * Flow:
 *   1. Mount → do a one-shot probe (`GET /api/drinks`). If the response is
 *      OK, `drinksBlocked` stays false. If the response is `drinks_blocked`,
 *      the axios interceptor calls `_drinksBlockedHandler` set here, which
 *      flips state to true AND starts polling every 10s to detect re-enable.
 *   2. During polling, a successful call flips state back to false and stops
 *      the interval — the provider stays quiet until the interceptor fires
 *      again.
 *   3. Unmount → detach the interceptor handler and clear any pending timer.
 *
 * 10 seconds is a compromise: fast enough that guests are unblocked shortly
 * after the couple re-enables the game, slow enough that a whole reception
 * hall polling in parallel does not hammer the backend.
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import api, { registerDrinksBlockedHandler, clearDrinksBlockedHandler, resetDrinksBlocked } from './api';

type BlockedFeaturesContextType = {
  drinksBlocked: boolean;
};

const BlockedFeaturesContext = createContext<BlockedFeaturesContextType>({ drinksBlocked: false });

/** Polling cadence while blocked — see file header for the rationale. */
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
    // Initial probe: if the game is already off at app start, this triggers
    // the handler above the same way a later blocked response would.
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

/** Consume the current drinks-block state anywhere below the provider. */
export function useBlockedFeatures() {
  return useContext(BlockedFeaturesContext);
}
