/**
 * `app/(tabs)/rsvp.tsx` — post-onboarding RSVP tab (solo + family).
 *
 * The tab is only reachable in the `accepted_pending` transition window. On
 * every focus/refresh it re-checks `rsvp_status` and route-guards out of the
 * screen when it flips to a terminal state.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockFetchGuestMe = jest.fn();
const mockFetchEventInfo = jest.fn();
const mockPostRsvp = jest.fn();
const mockPostGroupRsvp = jest.fn();
jest.mock('../../lib/guest', () => {
  const actual = jest.requireActual('../../lib/guest');
  return {
    __esModule: true,
    ...actual,
    fetchGuestMe: (...args: any[]) => mockFetchGuestMe(...args),
    fetchEventInfo: (...args: any[]) => mockFetchEventInfo(...args),
    postRsvp: (...args: any[]) => mockPostRsvp(...args),
    postGroupRsvp: (...args: any[]) => mockPostGroupRsvp(...args),
  };
});

// See `tests/app/declined.test.tsx` — the same hoisted-hook stub applies.
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) };
});

import RsvpTabScreen from '../../app/(tabs)/rsvp';
import { LanguageProvider } from '../../lib/LanguageContext';
import { EventThemeProvider } from '../../lib/EventThemeContext';

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <RsvpTabScreen />
      </EventThemeProvider>
    </LanguageProvider>
  );
}

const soloGuest = {
  guest_id: 1,
  firstname: 'Ada',
  lastname: 'L',
  type: 'solo',
  family_name: null,
  rsvp_status: 'accepted_pending',
  rsvp_set_by: null,
  group_members: [],
};

const familyGuest = {
  guest_id: 1,
  firstname: 'Ada',
  lastname: 'L',
  type: 'family',
  family_name: 'Caspari',
  rsvp_status: 'accepted_pending',
  rsvp_set_by: null,
  group_members: [
    { guest_id: 2, firstname: 'Bea', lastname: 'C', rsvp_status: null, rsvp_set_by: null },
    { guest_id: 3, firstname: 'Cee', lastname: 'C', rsvp_status: null, rsvp_set_by: null },
  ],
};

describe('app/(tabs)/rsvp', () => {
  beforeEach(() => {
    mockFetchGuestMe.mockReset();
    mockFetchEventInfo.mockReset();
    mockPostRsvp.mockReset();
    mockPostGroupRsvp.mockReset();
    (router.replace as jest.Mock).mockClear();
  });

  it('solo guest sees own accept + decline buttons', async () => {
    mockFetchGuestMe.mockResolvedValue(soloGuest);
    mockFetchEventInfo.mockResolvedValue({ rsvp_deadline: '2099-08-01T00:00:00Z' });

    const { findByText } = renderScreen();

    await findByText('Zusagen');
    await findByText('Absagen');
  });

  it('family guest sees every group member row', async () => {
    mockFetchGuestMe.mockResolvedValue(familyGuest);
    mockFetchEventInfo.mockResolvedValue({ rsvp_deadline: '2099-08-01T00:00:00Z' });

    const { findByText } = renderScreen();

    // Each group member's full name appears in the list.
    await findByText(/Bea C/);
    await findByText(/Cee C/);
  });

  it('routes to /declined when the guest is in a decline sub-state', async () => {
    mockFetchGuestMe.mockResolvedValue({ ...soloGuest, rsvp_status: 'declined_pending' });
    mockFetchEventInfo.mockResolvedValue({ rsvp_deadline: '2099-08-01T00:00:00Z' });

    renderScreen();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/declined'));
  });

  it('routes to /(tabs)/home once the couple confirms the acceptance', async () => {
    mockFetchGuestMe.mockResolvedValue({ ...soloGuest, rsvp_status: 'accepted' });
    mockFetchEventInfo.mockResolvedValue({ rsvp_deadline: '2099-08-01T00:00:00Z' });

    renderScreen();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)/home'));
  });

  it('tapping Absagen fires the double-confirm alert', async () => {
    mockFetchGuestMe.mockResolvedValue(soloGuest);
    mockFetchEventInfo.mockResolvedValue({ rsvp_deadline: '2099-08-01T00:00:00Z' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { findByText } = renderScreen();
    const decline = await findByText('Absagen');
    fireEvent.press(decline);

    expect(alertSpy).toHaveBeenCalled();
    const [, , buttons] = alertSpy.mock.calls[0] as any;
    expect(buttons[1].style).toBe('destructive');
    // The destructive callback wraps handleOwnRsvp(false).
    mockPostRsvp.mockResolvedValue('declined');
    await act(async () => {
      await buttons[1].onPress?.();
    });
    await waitFor(() => {
      expect(mockPostRsvp).toHaveBeenCalledWith(false);
      expect(router.replace).toHaveBeenCalledWith('/declined');
    });
    alertSpy.mockRestore();
  });
});
