/**
 * `app/rsvp.tsx` — onboarding RSVP shown right after first login.
 *
 * Behaviour under test:
 *   - Accept posts `postRsvp(true)` and reveals the "Continue" CTA.
 *   - Decline surfaces the double-confirm `Alert`; confirming posts
 *     `postRsvp(false)` and hard-redirects to `/declined`.
 *   - Continue routes into the tab layout.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockFetchGuestMe = jest.fn();
const mockFetchEventInfo = jest.fn();
const mockPostRsvp = jest.fn();
jest.mock('../../lib/guest', () => {
  const actual = jest.requireActual('../../lib/guest');
  return {
    __esModule: true,
    ...actual,
    fetchGuestMe: (...args: any[]) => mockFetchGuestMe(...args),
    fetchEventInfo: (...args: any[]) => mockFetchEventInfo(...args),
    postRsvp: (...args: any[]) => mockPostRsvp(...args),
  };
});

import RsvpScreen from '../../app/rsvp';
import { LanguageProvider } from '../../lib/LanguageContext';
import { EventThemeProvider } from '../../lib/EventThemeContext';

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <RsvpScreen />
      </EventThemeProvider>
    </LanguageProvider>,
  );
}

const baseGuest = {
  guest_id: 1,
  firstname: 'Ada',
  lastname: 'Lovelace',
  type: 'solo',
  family_name: null,
  rsvp_status: null,
  rsvp_set_by: null,
  group_members: [],
};

describe('app/rsvp — onboarding', () => {
  beforeEach(() => {
    mockFetchGuestMe.mockReset();
    mockFetchEventInfo.mockReset();
    mockPostRsvp.mockReset();
    (router.replace as jest.Mock).mockClear();
  });

  it('accept posts the RSVP and reveals the continue CTA', async () => {
    mockFetchGuestMe.mockResolvedValue({ ...baseGuest });
    mockFetchEventInfo.mockResolvedValue({ rsvp_deadline: '2026-08-01T00:00:00Z' });
    mockPostRsvp.mockResolvedValue('accepted_pending');

    const { findByText } = renderScreen();
    const accept = await findByText('Zusagen');

    await act(async () => {
      fireEvent.press(accept);
    });

    await waitFor(() => expect(mockPostRsvp).toHaveBeenCalledWith(true));
    await findByText('Weiter');
  });

  it('continue routes into the tab layout', async () => {
    // Start already-accepted so the continue button is present immediately.
    mockFetchGuestMe.mockResolvedValue({ ...baseGuest, rsvp_status: 'accepted_pending' });
    mockFetchEventInfo.mockResolvedValue({ rsvp_deadline: '2026-08-01T00:00:00Z' });

    const { findByText } = renderScreen();
    const cont = await findByText('Weiter');

    await act(async () => {
      fireEvent.press(cont);
    });

    expect(router.replace).toHaveBeenCalledWith('/(tabs)/home');
  });

  it('decline goes through the confirm dialog before posting', async () => {
    mockFetchGuestMe.mockResolvedValue({ ...baseGuest });
    mockFetchEventInfo.mockResolvedValue({ rsvp_deadline: '2026-08-01T00:00:00Z' });
    mockPostRsvp.mockResolvedValue('declined_pending');

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: any) => {
      // Fire the destructive "Ja, absagen" callback synchronously so we don't
      // have to simulate the OS-level dialog interaction.
      const confirm = buttons?.find((b: any) => b.style === 'destructive');
      confirm?.onPress?.();
    });

    const { findByText } = renderScreen();
    const decline = await findByText('Absagen');

    await act(async () => {
      fireEvent.press(decline);
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Wirklich absagen?',
        expect.any(String),
        expect.any(Array),
      );
      expect(mockPostRsvp).toHaveBeenCalledWith(false);
      expect(router.replace).toHaveBeenCalledWith('/declined');
    });

    alertSpy.mockRestore();
  });
});
