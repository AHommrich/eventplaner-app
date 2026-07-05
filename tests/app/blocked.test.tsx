/**
 * `app/blocked.tsx` — full-screen barrier when the backend flags `app_blocked`.
 *
 * The screen has three observable behaviours:
 *   1. Renders the localised title + message from `blocked.*`.
 *   2. Polls `GET /api/guest/me` on a 10-second interval.
 *   3. On a successful poll, resets the interceptor debounce and
 *      navigates back to `/`.
 *
 * Timers are faked so the 10-second cadence resolves synchronously; the
 * `api`/`clearBlocked` module is mocked wholesale so the interceptors from
 * `lib/api.ts` never run in this suite.
 */
import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

// The `api` default export is called via `.get`; `clearBlocked` is a named
// export the screen invokes right before the redirect.
const mockGet = jest.fn();
const mockClearBlocked = jest.fn();
jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: { get: (...args: any[]) => mockGet(...args) },
  clearBlocked: (...args: any[]) => mockClearBlocked(...args),
}));

import BlockedScreen from '../../app/blocked';
import { LanguageProvider } from '../../lib/LanguageContext';

function renderScreen() {
  return render(
    <LanguageProvider>
      <BlockedScreen />
    </LanguageProvider>
  );
}

describe('app/blocked', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGet.mockReset();
    mockClearBlocked.mockReset();
    (router.replace as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the localised block message', async () => {
    const { findByText } = renderScreen();
    // German is the default locale in `tests/setup.ts` — check both strings.
    await findByText('Zugang gesperrt');
    await findByText(/Wir prüfen automatisch/);
  });

  it('redirects back to `/` when the poll succeeds', async () => {
    mockGet.mockResolvedValue({ data: {} });
    renderScreen();

    // Advance past the 10-second poll cadence.
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/guest/me');
      expect(mockClearBlocked).toHaveBeenCalled();
      expect(router.replace).toHaveBeenCalledWith('/');
    });
  });

  it('keeps polling silently when the backend is still blocked', async () => {
    mockGet.mockRejectedValue(new Error('still blocked'));
    renderScreen();

    // Two tick advances — the first rejects, the loop must survive it.
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(router.replace).not.toHaveBeenCalled();
    expect(mockClearBlocked).not.toHaveBeenCalled();
  });
});
