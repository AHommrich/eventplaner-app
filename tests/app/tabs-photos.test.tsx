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
import { Alert, Dimensions } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockApiGet = jest.fn();
const mockApiPost = jest.fn();
jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: { get: (...a: any[]) => mockApiGet(...a), post: (...a: any[]) => mockApiPost(...a) },
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
    mockApiPost.mockReset();
    await SecureStore.deleteItemAsync('consent_photo_upload');
  });

  it('shows the empty-state hint when the backend returns no photos', async () => {
    mockApiGet.mockResolvedValue({ data: { data: [] } });

    const { UNSAFE_root } = renderScreen();
    await waitFor(() =>
      expect(UNSAFE_root.findAllByProps({ testID: 'photos-empty-state' }).length).toBeGreaterThan(0)
    );
  });

  it('renders the grid after a successful fetch', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            url: 'https://x/1.jpg',
            guest_id: 11,
            guest_name: 'Ada',
            created_at: '2026-06-01T00:00:00Z',
          },
          {
            id: 2,
            url: 'https://x/2.jpg',
            guest_id: 12,
            guest_name: 'Bea',
            created_at: '2026-06-01T00:00:00Z',
          },
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

  it('report modal opens with all reason options', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            url: 'https://x/1.jpg',
            guest_id: 11,
            guest_name: 'Ada',
            created_at: '2026-06-01T00:00:00Z',
          },
        ],
      },
    });

    const { findByTestId, findByText } = renderScreen();
    fireEvent.press(await findByTestId('photo-1'));
    fireEvent.press(await findByTestId('report-photo-button'));

    await findByText('Unangemessener Inhalt');
    await findByText('Persönlichkeitsrechte');
    await findByText('Sonstiges');
  });

  it('closing the detail view also clears an open report sheet', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            url: 'https://x/1.jpg',
            guest_id: 11,
            guest_name: 'Ada',
            created_at: '2026-06-01T00:00:00Z',
          },
        ],
      },
    });

    const { findByLabelText, findByTestId, findByText, queryByText } = renderScreen();
    fireEvent.press(await findByTestId('photo-1'));
    fireEvent.press(await findByTestId('report-photo-button'));
    await findByText('Foto melden');

    fireEvent.press(await findByLabelText('Foto schließen'));

    await waitFor(() => expect(queryByText('Foto melden')).toBeNull());
    fireEvent.press(await findByTestId('photo-1'));
    await findByText('Ada');
  });

  it('swiping the detail pager updates the selected photo', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            url: 'https://x/1.jpg',
            guest_id: 11,
            guest_name: 'Ada',
            created_at: '2026-06-01T00:00:00Z',
          },
          {
            id: 2,
            url: 'https://x/2.jpg',
            guest_id: 12,
            guest_name: 'Bea',
            created_at: '2026-06-01T00:00:00Z',
          },
        ],
      },
    });

    const { findByTestId, findByText } = renderScreen();
    fireEvent.press(await findByTestId('photo-1'));
    const pager = await findByTestId('photo-detail-pager');

    fireEvent(pager, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: Dimensions.get('window').width, y: 0 } },
    });

    await findByText('Bea');
  });

  it('submitting an other-report posts the expected body and removes the photo locally', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            url: 'https://x/1.jpg',
            guest_id: 11,
            guest_name: 'Ada',
            created_at: '2026-06-01T00:00:00Z',
          },
        ],
      },
    });
    mockApiPost.mockResolvedValue({ data: { id: 9, status: 'open', auto_hidden: true } });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { findByTestId, findByText, queryByTestId } = renderScreen();
    fireEvent.press(await findByTestId('photo-1'));
    fireEvent.press(await findByTestId('report-photo-button'));
    fireEvent.press(await findByText('Sonstiges'));
    fireEvent.press(await findByText('Absenden'));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/api/photos/1/report', { reason: 'other' })
    );
    await waitFor(() => expect(queryByTestId('photo-1')).toBeNull());
    expect(alertSpy).toHaveBeenCalledWith('Foto gemeldet — es ist für Dich ausgeblendet.');
    alertSpy.mockRestore();
  });

  it('429 report response shows the rate-limit message', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            url: 'https://x/1.jpg',
            guest_id: 11,
            guest_name: 'Ada',
            created_at: '2026-06-01T00:00:00Z',
          },
        ],
      },
    });
    mockApiPost.mockRejectedValue({ response: { status: 429 } });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { findByTestId, findByText } = renderScreen();
    fireEvent.press(await findByTestId('photo-1'));
    fireEvent.press(await findByTestId('report-photo-button'));
    fireEvent.press(await findByText('Absenden'));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Zu viele Meldungen. Bitte warte eine Weile.')
    );
    alertSpy.mockRestore();
  });

  it('hide-uploader button is hidden for owner uploads', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            url: 'https://x/1.jpg',
            guest_id: null,
            guest_name: 'Admin',
            created_at: '2026-06-01T00:00:00Z',
          },
        ],
      },
    });

    const { findByTestId, queryByText } = renderScreen();
    fireEvent.press(await findByTestId('photo-1'));
    expect(queryByText('Uploader ausblenden')).toBeNull();
  });

  it('hide-uploader confirm posts and removes every photo from that guest', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            url: 'https://x/1.jpg',
            guest_id: 11,
            guest_name: 'Ada',
            created_at: '2026-06-01T00:00:00Z',
          },
          {
            id: 2,
            url: 'https://x/2.jpg',
            guest_id: 11,
            guest_name: 'Ada',
            created_at: '2026-06-01T00:00:00Z',
          },
          {
            id: 3,
            url: 'https://x/3.jpg',
            guest_id: 12,
            guest_name: 'Bea',
            created_at: '2026-06-01T00:00:00Z',
          },
        ],
      },
    });
    mockApiPost.mockResolvedValue({ data: { hidden_guest_id: 11 } });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { findByTestId, queryByTestId } = renderScreen();
    fireEvent.press(await findByTestId('photo-1'));
    fireEvent.press(await findByTestId('hide-uploader-button'));

    const [, , buttons] = alertSpy.mock.calls[0] as any;
    await act(async () => {
      await buttons[1].onPress();
    });

    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/api/guests/11/hide-content'));
    await waitFor(() => {
      expect(queryByTestId('photo-1')).toBeNull();
      expect(queryByTestId('photo-2')).toBeNull();
      expect(queryByTestId('photo-3')).not.toBeNull();
    });
    alertSpy.mockRestore();
  });
});
