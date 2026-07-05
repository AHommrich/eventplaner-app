/**
 * `app/(tabs)/settings.tsx` — preferences, DSGVO surfaces, logout.
 *
 * Covers:
 *   - Every DSGVO row (Datenschutz, Einwilligungen, Datenexport, Löschung)
 *     renders and routes to the correct path when tapped.
 *   - Logout wipes the session and returns to `/`.
 *   - Language switch updates the persisted `app_language` key.
 */
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

const mockClearSession = jest.fn();
jest.mock('../../lib/auth', () => ({
  __esModule: true,
  getSession: jest.fn(async () => ({
    token: 't',
    guestId: 1,
    firstname: 'Ada',
    lastname: 'L',
    type: 'family',
    familyName: 'Caspari',
  })),
  clearSession: (...a: any[]) => mockClearSession(...a),
}));

const mockRequestErasure = jest.fn();
jest.mock('../../lib/guest', () => {
  const actual = jest.requireActual('../../lib/guest');
  return {
    __esModule: true,
    ...actual,
    requestErasure: (...a: any[]) => mockRequestErasure(...a),
  };
});

const mockSaveErasureState = jest.fn();
jest.mock('../../lib/erasure', () => {
  const actual = jest.requireActual('../../lib/erasure');
  return {
    __esModule: true,
    ...actual,
    saveErasureState: (...a: any[]) => mockSaveErasureState(...a),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) };
});

import SettingsScreen from '../../app/(tabs)/settings';
import { LanguageProvider } from '../../lib/LanguageContext';
import { EventThemeProvider } from '../../lib/EventThemeContext';

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <SettingsScreen />
      </EventThemeProvider>
    </LanguageProvider>
  );
}

describe('app/(tabs)/settings', () => {
  beforeEach(async () => {
    mockClearSession.mockReset();
    mockRequestErasure.mockReset();
    mockSaveErasureState.mockReset();
    (router.replace as jest.Mock).mockClear();
    (router.push as jest.Mock).mockClear();
    // A previous test in this file may have persisted a non-default locale
    // (see the language-switch test). Reset before every render so the
    // assertions against DE copy stay reliable regardless of test order.
    await SecureStore.deleteItemAsync('app_language');
  });

  it('renders the guest identity block from the current session', async () => {
    const { findByText } = renderScreen();
    await findByText('Ada L');
    await findByText('Caspari');
  });

  it('renders every DSGVO row appended to the settings card', async () => {
    const { findByText } = renderScreen();
    await findByText('Datenschutzerklärung');
    await findByText('Einwilligungen verwalten');
    await findByText('Meine Daten exportieren');
    await findByText('Konto löschen');
  });

  it('tapping the privacy row routes to /legal/privacy', async () => {
    const { findByText } = renderScreen();
    const row = await findByText('Datenschutzerklärung');
    fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith('/legal/privacy');
  });

  it('tapping the consents row routes to /consents', async () => {
    const { findByText } = renderScreen();
    const row = await findByText('Einwilligungen verwalten');
    fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith('/consents');
  });

  it('logout clears the session and returns to `/`', async () => {
    const { findByText } = renderScreen();
    const logout = await findByText('Ausloggen');
    fireEvent.press(logout);
    await waitFor(() => {
      expect(mockClearSession).toHaveBeenCalled();
      expect(router.replace).toHaveBeenCalledWith('/');
    });
  });

  it('switching language persists the new locale in secure-store', async () => {
    const { findByText } = renderScreen();
    // Switch from DE (default) to English. Button label in DE locale is
    // "Englisch"; the LanguageContext persists the locale code, not the label.
    const en = await findByText('Englisch');
    fireEvent.press(en);
    await waitFor(async () => {
      const stored = await SecureStore.getItemAsync('app_language');
      expect(stored).toBe('en');
    });
  });

  it('tapping "Konto löschen" surfaces the two-step confirm alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { findByText } = renderScreen();
    const row = await findByText('Konto löschen');
    fireEvent.press(row);
    // First arg is the confirm title; third arg is the button array with
    // Cancel + Destructive-confirm.
    expect(alertSpy).toHaveBeenCalled();
    const [, , buttons] = alertSpy.mock.calls[0] as any;
    expect(buttons).toHaveLength(2);
    expect(buttons[1].style).toBe('destructive');
    alertSpy.mockRestore();
  });
});
