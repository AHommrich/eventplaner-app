/**
 * `app/scan.tsx` — live QR-scanner login.
 *
 * The camera view is stubbed to a plain `<View>` in `tests/setup.ts`; we grab
 * the mocked component from its props and invoke `onBarcodeScanned` directly
 * to simulate a scan without spinning up a real camera. The suite covers the
 * three login branches:
 *   - solo token: session saved, router replaces by RSVP status
 *   - family token: picker opens with every group member
 *   - 409 on family select: alert + row greyed out
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const mockApiGet = jest.fn();
const mockApiPost = jest.fn();
const mockRequestPermission = jest.fn();
jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: { get: (...a: any[]) => mockApiGet(...a), post: (...a: any[]) => mockApiPost(...a) },
}));

const mockGetSession = jest.fn();
const mockSaveSession = jest.fn();
jest.mock('../../lib/auth', () => ({
  __esModule: true,
  getSession: (...a: any[]) => mockGetSession(...a),
  saveSession: (...a: any[]) => mockSaveSession(...a),
}));

const mockFetchGuestMe = jest.fn();
jest.mock('../../lib/guest', () => {
  const actual = jest.requireActual('../../lib/guest');
  return {
    __esModule: true,
    ...actual,
    fetchGuestMe: (...a: any[]) => mockFetchGuestMe(...a),
  };
});

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
    useCameraPermissions: () => [{ granted: true }, mockRequestPermission],
  };
});

import ScanScreen from '../../app/scan';
import { LanguageProvider } from '../../lib/LanguageContext';
import { EventThemeProvider } from '../../lib/EventThemeContext';
import { ConsentGateProvider } from '../../components/ConsentGate';
import { grantConsent } from '../../lib/consents';

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <ConsentGateProvider>
          <ScanScreen />
        </ConsentGateProvider>
      </EventThemeProvider>
    </LanguageProvider>
  );
}

describe('app/scan', () => {
  beforeEach(async () => {
    barcodeHandler = null;
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockGetSession.mockReset();
    mockSaveSession.mockReset();
    mockFetchGuestMe.mockReset();
    mockRequestPermission.mockReset();
    (router.replace as jest.Mock).mockClear();
    (router.back as jest.Mock).mockClear();
    mockGetSession.mockResolvedValue(null);
    await SecureStore.deleteItemAsync('consent_camera_scan');
  });

  it('asks for camera_scan consent before rendering the camera preview', async () => {
    const { findByText, findByTestId, queryByTestId } = renderScreen();

    expect(queryByTestId('camera-view')).toBeNull();
    fireEvent.press(await findByText('Ich stimme zu'));

    await findByTestId('camera-view');
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('existing session redirects before rendering the camera preview', async () => {
    await grantConsent('camera_scan');
    mockGetSession.mockResolvedValue({ token: 'existing-token', guestId: 5 });
    mockFetchGuestMe.mockResolvedValue({ rsvp_status: 'accepted' });

    const { queryByTestId } = renderScreen();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)/home'));
    expect(queryByTestId('camera-view')).toBeNull();
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('solo token: saves session and redirects to tabs/home', async () => {
    await grantConsent('camera_scan');
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
    mockFetchGuestMe.mockResolvedValue({ rsvp_status: 'accepted' });

    const { findByTestId } = renderScreen();
    await findByTestId('camera-view');
    // Trigger the barcode-scanned handler manually.
    await act(async () => {
      barcodeHandler?.({ data: 'https://hommrich.app/qr/tok-solo' });
    });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/auth/qr/tok-solo');
      expect(mockSaveSession).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'BEARER', guestId: 5, type: 'solo' })
      );
      expect(router.replace).toHaveBeenCalledWith('/(tabs)/home');
    });
  });

  it('family token: opens the picker with every group member', async () => {
    await grantConsent('camera_scan');
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

    const { findByText, findByTestId } = renderScreen();
    await findByTestId('camera-view');
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
    await grantConsent('camera_scan');
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

    const { findByText, findByTestId } = renderScreen();
    await findByTestId('camera-view');
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

  it('open family picker cannot select another guest after a session exists', async () => {
    await grantConsent('camera_scan');
    mockApiGet.mockResolvedValue({
      data: {
        type: 'family',
        family_name: null,
        guests: [
          { guest_id: 1, firstname: 'Anna', lastname: 'C', token: null, is_active: false },
          { guest_id: 2, firstname: 'Bea', lastname: 'C', token: null, is_active: false },
        ],
      },
    });

    const { findByText, findByTestId } = renderScreen();
    await findByTestId('camera-view');
    await act(async () => {
      barcodeHandler?.({ data: 'https://hommrich.app/qr/fam-token' });
    });

    const row = await findByText('Bea C');
    mockGetSession.mockResolvedValue({ token: 'existing-token', guestId: 1 });
    mockFetchGuestMe.mockResolvedValue({ rsvp_status: 'accepted' });

    await act(async () => {
      fireEvent.press(row);
    });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)/home'));
    expect(mockApiPost).not.toHaveBeenCalled();
    expect(mockSaveSession).not.toHaveBeenCalled();
  });
});
