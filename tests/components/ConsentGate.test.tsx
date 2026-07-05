/**
 * `ConsentGateProvider` + `useConsentGate` — modal-driven consent flow.
 */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { LanguageProvider } from '../../lib/LanguageContext';
import { EventThemeProvider } from '../../lib/EventThemeContext';
import { ConsentGateProvider, useConsentGate } from '../../components/ConsentGate';

// EventTheme mounts fetch on-token — with none present it stays on fallback.
jest.mock('../../lib/guest', () => ({
  __esModule: true,
  fetchEventInfo: jest.fn().mockResolvedValue({}),
}));

function Harness({ onResult }: { onResult: (v: boolean) => void }) {
  const { ensureConsent } = useConsentGate();
  return (
    <TouchableOpacity
      testID="trigger"
      onPress={async () => {
        const granted = await ensureConsent('photo_upload');
        onResult(granted);
      }}
    >
      <Text>trigger</Text>
    </TouchableOpacity>
  );
}

function renderProvider(onResult: (v: boolean) => void) {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <ConsentGateProvider>
          <Harness onResult={onResult} />
        </ConsentGateProvider>
      </EventThemeProvider>
    </LanguageProvider>
  );
}

describe('components/ConsentGate', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync('consent_photo_upload');
  });

  it('resolves true immediately when consent was previously granted', async () => {
    await SecureStore.setItemAsync(
      'consent_photo_upload',
      JSON.stringify({ granted_at: new Date().toISOString() })
    );
    const onResult = jest.fn();
    const { getByTestId } = renderProvider(onResult);

    await act(async () => {
      fireEvent.press(getByTestId('trigger'));
    });

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it('shows the modal when consent is missing and resolves true after grant', async () => {
    const onResult = jest.fn();
    const { getByTestId, getByText } = renderProvider(onResult);

    await act(async () => {
      fireEvent.press(getByTestId('trigger'));
    });

    // Modal is visible — the grant button carries the DE locale string.
    const grant = await waitFor(() => getByText('Ich stimme zu'));

    await act(async () => {
      fireEvent.press(grant);
    });

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    const stored = await SecureStore.getItemAsync('consent_photo_upload');
    expect(stored).toBeTruthy();
  });

  it('resolves false when the modal is dismissed via decline', async () => {
    const onResult = jest.fn();
    const { getByTestId, getByText } = renderProvider(onResult);

    await act(async () => {
      fireEvent.press(getByTestId('trigger'));
    });

    const decline = await waitFor(() => getByText('Abbrechen'));
    await act(async () => {
      fireEvent.press(decline);
    });

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    // No persistence on decline — the next call must ask again.
    expect(await SecureStore.getItemAsync('consent_photo_upload')).toBeNull();
  });
});
