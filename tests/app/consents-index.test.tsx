/**
 * `app/consents/index.tsx` — consent-management screen (Art. 7 (3)).
 *
 * Cases:
 *   - Both purposes not granted → each card shows "not granted", no revoke.
 *   - Purpose already granted → timestamp + revoke button.
 *   - Revoke goes through the confirmation Alert before clearing the record.
 */
import React from 'react';
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) };
});

import ConsentsScreen from '../../app/consents';
import { LanguageProvider } from '../../lib/LanguageContext';
import { EventThemeProvider } from '../../lib/EventThemeContext';

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <ConsentsScreen />
      </EventThemeProvider>
    </LanguageProvider>
  );
}

describe('app/consents', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync('consent_photo_upload');
    await SecureStore.deleteItemAsync('consent_photo_game');
  });

  it('shows every purpose card with "not granted" when nothing was stored yet', async () => {
    const { findAllByText, queryByText } = renderScreen();

    // `consents.notGranted` renders per card — expect one occurrence per
    // purpose in `ALL_PURPOSES`.
    const notGranted = await findAllByText('Noch nicht erteilt');
    expect(notGranted.length).toBeGreaterThanOrEqual(2);
    // Revoke button never appears when no consent is stored.
    expect(queryByText('Widerrufen')).toBeNull();
  });

  it('renders the granted timestamp + revoke button for stored consents', async () => {
    await SecureStore.setItemAsync(
      'consent_photo_upload',
      JSON.stringify({ granted_at: '2026-06-01T00:00:00Z' })
    );

    const { findByText, findAllByText } = renderScreen();

    // Timestamp appears in the granted card.
    await findByText(/Erteilt am 01\. Juni 2026/);
    // Only ONE revoke button (only the upload consent is granted).
    const revoke = await findAllByText('Widerrufen');
    expect(revoke).toHaveLength(1);
  });

  it('revoke goes through the confirmation Alert before wiping the record', async () => {
    await SecureStore.setItemAsync(
      'consent_photo_upload',
      JSON.stringify({ granted_at: '2026-06-01T00:00:00Z' })
    );

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: any) => {
      const destructive = buttons?.find((b: any) => b.style === 'destructive');
      destructive?.onPress?.();
    });

    const { findAllByText } = renderScreen();
    const [revoke] = await findAllByText('Widerrufen');

    fireEvent.press(revoke);

    await waitFor(async () => {
      expect(alertSpy).toHaveBeenCalled();
      // The record is wiped after the destructive confirmation runs.
      expect(await SecureStore.getItemAsync('consent_photo_upload')).toBeNull();
    });

    alertSpy.mockRestore();
  });
});
