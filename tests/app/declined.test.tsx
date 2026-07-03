/**
 * `app/declined.tsx` — post-decline landing with revocation-request flow.
 *
 * Three observable branches drive the render:
 *   - `declined_pending` shows the revoke button;
 *   - `declined` (final) omits it;
 *   - `revocation_requested` shows the waiting subtitle.
 *
 * Plus the state-transition tests: tapping revoke calls `postRevoke`, tapping
 * logout wipes the session and routes to `/`. The 30-second poll is not
 * exercised here — the polling contract itself is already covered by
 * `blocked.test.tsx`; here we care about what the screen renders.
 */
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockFetchGuestMe = jest.fn();
const mockFetchEventInfo = jest.fn();
const mockPostRevoke = jest.fn();
jest.mock('../../lib/guest', () => {
  const actual = jest.requireActual('../../lib/guest');
  return {
    __esModule: true,
    ...actual,
    fetchGuestMe: (...args: any[]) => mockFetchGuestMe(...args),
    fetchEventInfo: (...args: any[]) => mockFetchEventInfo(...args),
    postRevoke: (...args: any[]) => mockPostRevoke(...args),
  };
});

const mockClearSession = jest.fn();
jest.mock('../../lib/auth', () => ({
  __esModule: true,
  clearSession: (...args: any[]) => mockClearSession(...args),
}));

// `app/declined.tsx` currently calls `useSafeAreaInsets` after an early
// return (parked as a follow-up in `docs/REFACTOR_PLAN.md`), which trips
// React 19's hook-order check inside `react-test-renderer`. Stubbing the
// hook with a plain function that returns a static value keeps the hook
// count stable across renders so the tests here run against the actual
// screen without the parked bug masking them.
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

import DeclinedScreen from '../../app/declined';
import { LanguageProvider } from '../../lib/LanguageContext';
import { EventThemeProvider } from '../../lib/EventThemeContext';

function baseGuest(overrides: any = {}) {
  return {
    guest_id: 1,
    firstname: 'Ada',
    lastname: 'Lovelace',
    type: 'solo',
    family_name: null,
    rsvp_status: 'declined_pending',
    rsvp_set_by: null,
    group_members: [],
    ...overrides,
  };
}

function baseEvent(overrides: any = {}) {
  return { rsvp_deadline: '2026-08-01T00:00:00Z', ...overrides };
}

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <DeclinedScreen />
      </EventThemeProvider>
    </LanguageProvider>,
  );
}

describe('app/declined', () => {
  beforeEach(() => {
    mockFetchGuestMe.mockReset();
    mockFetchEventInfo.mockReset();
    mockPostRevoke.mockReset();
    mockClearSession.mockReset();
    (router.replace as jest.Mock).mockClear();
  });

  it('shows the revoke button in the `declined_pending` state', async () => {
    mockFetchGuestMe.mockResolvedValue(baseGuest({ rsvp_status: 'declined_pending' }));
    mockFetchEventInfo.mockResolvedValue(baseEvent());

    const { findByText } = renderScreen();

    // `declined.revokeButton` in DE is "Absage zurücknehmen".
    await findByText('Rücknahme beantragen');
  });

  it('hides the revoke button after the couple confirms the decline', async () => {
    mockFetchGuestMe.mockResolvedValue(baseGuest({ rsvp_status: 'declined' }));
    mockFetchEventInfo.mockResolvedValue(baseEvent());

    const { findByText, queryByText } = renderScreen();

    // Final title renders; revoke button does not.
    await findByText(/Deine Einladung wurde abgesagt/);
    expect(queryByText('Rücknahme beantragen')).toBeNull();
  });

  it('logout wipes the session and returns to `/`', async () => {
    mockFetchGuestMe.mockResolvedValue(baseGuest({ rsvp_status: 'declined' }));
    mockFetchEventInfo.mockResolvedValue(baseEvent());

    const { findByText } = renderScreen();
    const logout = await findByText('Ausloggen');

    await act(async () => {
      fireEvent.press(logout);
    });

    await waitFor(() => {
      expect(mockClearSession).toHaveBeenCalled();
      expect(router.replace).toHaveBeenCalledWith('/');
    });
  });

  it('revoke triggers `postRevoke` and moves the guest to the waiting state', async () => {
    mockFetchGuestMe.mockResolvedValue(baseGuest({ rsvp_status: 'declined_pending' }));
    mockFetchEventInfo.mockResolvedValue(baseEvent());
    mockPostRevoke.mockResolvedValue('revocation_requested');

    const { findByText } = renderScreen();
    const revoke = await findByText('Rücknahme beantragen');

    await act(async () => {
      fireEvent.press(revoke);
    });

    await waitFor(() => expect(mockPostRevoke).toHaveBeenCalled());
    // After the revocation request lands the waiting subtitle appears.
    await findByText(/Deine Anfrage zur Rücknahme wird geprüft/);
  });
});
