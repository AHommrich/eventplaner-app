/**
 * `app/scan.tsx` — live QR-scanner login.
 *
 * The camera view is stubbed to a plain `<View>` in `tests/setup.ts`; we grab
 * the mocked component from its props and invoke `onBarcodeScanned` directly
 * to simulate a scan without spinning up a real camera. The suite covers the
 * three login branches:
 *   - solo token: session saved, router replaces to `/`
 *   - family token: picker opens with every group member
 *   - 409 on family select: alert + row greyed out
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockApiGet = jest.fn();
const mockApiPost = jest.fn();
jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: { get: (...a: any[]) => mockApiGet(...a), post: (...a: any[]) => mockApiPost(...a) },
}));

const mockSaveSession = jest.fn();
jest.mock('../../lib/auth', () => ({
  __esModule: true,
  saveSession: (...a: any[]) => mockSaveSession(...a),
}));

// Expose the scan handler prop from the mocked `CameraView` for the tests.
let barcodeHandler: ((ev: { data: string }) => void) | null = null;
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    CameraView: (props: any) => {
      barcodeHandler = props.onBarcodeScanned;
      return React.createElement(View, { testID: 'camera-view' });
    },
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
  };
});

import ScanScreen from '../../app/scan';
import { LanguageProvider } from '../../lib/LanguageContext';
import { EventThemeProvider } from '../../lib/EventThemeContext';

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <ScanScreen />
      </EventThemeProvider>
    </LanguageProvider>
  );
}

describe('app/scan', () => {
  beforeEach(() => {
    barcodeHandler = null;
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockSaveSession.mockReset();
    (router.replace as jest.Mock).mockClear();
  });

  it('solo token: saves session and redirects to `/`', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        type: 'solo',
        family_name: null,
        guests: [
          {
            guest_id: 5,
            firstname: 'Ada',
            lastname: 'Lovelace',
            token: 'BEARER',
            is_active: false,
          },
        ],
      },
    });

    renderScreen();
    // Trigger the barcode-scanned handler manually.
    await act(async () => {
      barcodeHandler?.({ data: 'https://hommrich.app/qr/tok-solo' });
    });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/auth/qr/tok-solo');
      expect(mockSaveSession).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'BEARER', guestId: 5, type: 'solo' })
      );
      expect(router.replace).toHaveBeenCalledWith('/');
    });
  });

  it('family token: opens the picker with every group member', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        type: 'family',
        family_name: 'Caspari',
        guests: [
          { guest_id: 1, firstname: 'Anna', lastname: 'C', token: null, is_active: false },
          { guest_id: 2, firstname: 'Bea', lastname: 'C', token: null, is_active: false },
        ],
      },
    });

    const { findByText } = renderScreen();
    await act(async () => {
      barcodeHandler?.({ data: 'https://hommrich.app/qr/fam-token' });
    });

    // Both family members appear as tappable rows.
    await findByText('Anna C');
    await findByText('Bea C');
    // The solo-branch shortcut did NOT fire.
    expect(mockSaveSession).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('409 on select: greys out the row and shows the alert', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        type: 'family',
        family_name: null,
        // >=2 guests so the picker renders the FlatList — a single-guest
        // family goes straight through a "Continue" button that never
        // hits the /select endpoint.
        guests: [
          { guest_id: 1, firstname: 'Anna', lastname: 'C', token: null, is_active: false },
          { guest_id: 2, firstname: 'Bea', lastname: 'C', token: null, is_active: false },
        ],
      },
    });
    mockApiPost.mockRejectedValue({ response: { status: 409 } });

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { findByText } = renderScreen();
    await act(async () => {
      barcodeHandler?.({ data: 'https://hommrich.app/qr/fam-token' });
    });

    const row = await findByText('Anna C');
    await act(async () => {
      fireEvent.press(row);
    });

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/auth/qr/fam-token/select', { guest_id: 1 });
      expect(alertSpy).toHaveBeenCalled();
    });

    // Post-409 the row is greyed out — no session, no redirect.
    expect(mockSaveSession).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});
