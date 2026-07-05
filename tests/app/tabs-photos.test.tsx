/**
 * `app/(tabs)/photos.tsx` — shared wedding gallery + upload FAB.
 *
 * Tests focus on:
 *   - empty vs populated grid rendering;
 *   - the consent gate wrapping the upload FAB (already-granted → alert
 *     appears immediately; missing → the modal appears first).
 *
 * The multipart upload path itself is intentionally not exercised end-to-end:
 * that touches `expo-image-manipulator`, `expo-image-picker` and a manual
 * `FormData` body — a real regression there would be visible in the manual
 * Phase 12 smoke, not in a screen test.
 */
import React from 'react';
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockApiGet = jest.fn();
jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: { get: (...a: any[]) => mockApiGet(...a), post: jest.fn() },
}));

// Same rationale as the other tab tests — safe-area hook stubbed to avoid the
// parked hook-order follow-up.
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) };
});

import PhotosScreen from '../../app/(tabs)/photos';
import { LanguageProvider } from '../../lib/LanguageContext';
import { EventThemeProvider } from '../../lib/EventThemeContext';
import { ConsentGateProvider } from '../../components/ConsentGate';

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <ConsentGateProvider>
          <PhotosScreen />
        </ConsentGateProvider>
      </EventThemeProvider>
    </LanguageProvider>
  );
}

describe('app/(tabs)/photos', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    await SecureStore.deleteItemAsync('consent_photo_upload');
  });

  it('shows the empty-state hint when the backend returns no photos', async () => {
    mockApiGet.mockResolvedValue({ data: { data: [] } });

    const { findByText } = renderScreen();
    // DE: `photos.empty` = "Noch keine Fotos".
    await findByText('Noch keine Fotos');
  });

  it('renders the grid after a successful fetch', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        data: [
          { id: 1, url: 'https://x/1.jpg', guest_name: 'Ada', created_at: '2026-06-01T00:00:00Z' },
          { id: 2, url: 'https://x/2.jpg', guest_name: 'Bea', created_at: '2026-06-01T00:00:00Z' },
        ],
      },
    });

    const { queryByText } = renderScreen();

    // Once the fetch resolves, the empty-state string disappears.
    await waitFor(() => expect(queryByText('Noch keine Fotos')).toBeNull());
    expect(mockApiGet).toHaveBeenCalledWith('/api/photos');
  });

  it('FAB opens the upload alert when consent is already granted', async () => {
    mockApiGet.mockResolvedValue({ data: { data: [] } });
    await SecureStore.setItemAsync(
      'consent_photo_upload',
      JSON.stringify({ granted_at: new Date().toISOString() })
    );

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { UNSAFE_root, findByText } = renderScreen();

    // Wait for the empty-state to appear so the render tree is stable.
    await findByText('Noch keine Fotos');

    // The FAB is the last node in the tree that carries an `onPress` handler.
    const pressNodes = UNSAFE_root.findAll((n: any) => typeof n?.props?.onPress === 'function');
    const fab = pressNodes[pressNodes.length - 1];

    await act(async () => {
      fireEvent.press(fab);
    });

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    alertSpy.mockRestore();
  });

  it('FAB shows the consent modal before the upload alert when consent is missing', async () => {
    mockApiGet.mockResolvedValue({ data: { data: [] } });

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { UNSAFE_root, findByText } = renderScreen();

    await findByText('Noch keine Fotos');

    const pressNodes = UNSAFE_root.findAll((n: any) => typeof n?.props?.onPress === 'function');
    const fab = pressNodes[pressNodes.length - 1];

    await act(async () => {
      fireEvent.press(fab);
    });

    // Modal-title copy for the consent gate.
    await findByText('Ich stimme zu');
    // Upload alert has NOT fired yet — the modal blocks it.
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
