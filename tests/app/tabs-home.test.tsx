/**
 * `app/(tabs)/home.tsx` — post-login landing screen.
 *
 * Tests focus on the observable event-info rendering path and the
 * tap-to-navigate dispatcher for the venue block. The 1-Hz countdown ticker
 * and the pull-to-refresh spinner are covered by their own unit tests
 * (`useRefreshToast`, plus the deterministic `calcCountdown` helper).
 */
import React from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockFetchEventInfo = jest.fn();
jest.mock('../../lib/guest', () => {
  const actual = jest.requireActual('../../lib/guest');
  return {
    __esModule: true,
    ...actual,
    fetchEventInfo: (...args: any[]) => mockFetchEventInfo(...args),
  };
});

jest.mock('../../lib/auth', () => ({
  __esModule: true,
  getSession: jest.fn(async () => ({
    token: 't',
    guestId: 1,
    firstname: 'Ada',
    lastname: 'L',
    type: 'solo',
    familyName: null,
  })),
  saveSession: jest.fn(),
}));

// `useBottomTabBarHeight` needs a mounted Tab.Navigator — not present in
// tests. A static number keeps the padding math working.
jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 48,
}));

// Same rationale as `tests/app/declined.test.tsx` — the Jest tree has no
// `SafeAreaProvider`, so the real hook would warn and return a placeholder.
// Static insets keep the render deterministic.
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) };
});

import HomeScreen from '../../app/(tabs)/home';
import { LanguageProvider } from '../../lib/LanguageContext';
import { EventThemeProvider } from '../../lib/EventThemeContext';

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <HomeScreen />
      </EventThemeProvider>
    </LanguageProvider>
  );
}

function baseEvent(overrides: any = {}) {
  return {
    name: 'André & Tabea',
    // A date far enough in the future that `calcCountdown` returns a real
    // days/hours/minutes/seconds tuple (not the "today" or "past" branch).
    date: '2099-06-01T14:00:00Z',
    cover_image_url: null,
    venue_name: 'Dernbacher Grillhütte',
    venue_address: 'Dernbach 1',
    venue_lat: 50.5,
    venue_lng: 7.5,
    venue_display_mode: 'both',
    dresscode: null,
    ...overrides,
  };
}

describe('app/(tabs)/home', () => {
  beforeEach(() => {
    mockFetchEventInfo.mockReset();
    (Linking.openURL as jest.Mock).mockClear();
    Platform.OS = 'ios';
  });

  it('renders event name, date, and venue after the fetch resolves', async () => {
    mockFetchEventInfo.mockResolvedValue(baseEvent());

    const { findByText } = renderScreen();

    await findByText('André & Tabea');
    await findByText('Dernbacher Grillhütte');
    await findByText('Dernbach 1');
  });

  it('tapping the venue on iOS surfaces the maps-app picker alert', async () => {
    mockFetchEventInfo.mockResolvedValue(baseEvent());
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { findByText } = renderScreen();
    const venue = await findByText('Dernbach 1');

    await act(async () => {
      fireEvent.press(venue);
    });

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    // Second-arg (hint copy) is a translation string; third-arg is the
    // Apple/Google/Cancel button array — three entries.
    const [, , buttons] = alertSpy.mock.calls[0] as any;
    expect(buttons).toHaveLength(3);
    alertSpy.mockRestore();
  });

  it('surfaces the load-error banner when `fetchEventInfo` fails', async () => {
    mockFetchEventInfo.mockRejectedValue({ message: 'boom' });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { findByText } = renderScreen();

    // German locale: `home.loadError` reads "Event-Infos konnten nicht geladen werden."
    await findByText('Event-Infos konnten nicht geladen werden.');
    warn.mockRestore();
  });

  it('retries loadData when the error banner retry button is pressed', async () => {
    mockFetchEventInfo.mockRejectedValueOnce({ message: 'boom' });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { findByText, findByTestId, queryByText } = renderScreen();
    await findByText('Event-Infos konnten nicht geladen werden.');

    mockFetchEventInfo.mockResolvedValueOnce({
      name: 'Anna & Ben',
      date: '2099-06-01T12:00:00Z',
      rsvp_deadline: '2099-05-01T00:00:00Z',
    });
    const retryButton = await findByTestId('error-banner-retry');
    await act(async () => {
      fireEvent.press(retryButton);
    });

    await findByText('Anna & Ben');
    expect(queryByText('Event-Infos konnten nicht geladen werden.')).toBeNull();
    warn.mockRestore();
  });
});
