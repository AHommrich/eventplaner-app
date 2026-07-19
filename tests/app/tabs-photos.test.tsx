/**
 * `app/(tabs)/photos.tsx` — shared wedding gallery + upload FAB.
 *
 * Tests focus on:
 *   - empty vs populated grid rendering;
 *   - the consent gate wrapping the upload FAB (already-granted → alert
 *     appears immediately; missing → the modal appears first).
 *
 * Upload coverage stays at the screen contract level: picker → JPEG
 * normalisation → multipart `photo` field → optimistic gallery prepend.
 * Native camera/library behaviour is still covered by manual smoke tests.
 */
import React from 'react';
import { Alert, Dimensions } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockApiGet = jest.fn();
const mockApiPost = jest.fn();
const mockApiDelete = jest.fn();
jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: {
    get: (...a: any[]) => mockApiGet(...a),
    post: (...a: any[]) => mockApiPost(...a),
    delete: (...a: any[]) => mockApiDelete(...a),
  },
  isHandledApiError: () => false,
}));

// Same rationale as the other tab tests — safe-area hook stubbed to avoid the
// parked hook-order follow-up.
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) };
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PhotosScreen from '../../app/(tabs)/photos';
import { LanguageProvider } from '../../lib/LanguageContext';
import { EventThemeProvider } from '../../lib/EventThemeContext';
import { ConsentGateProvider } from '../../components/ConsentGate';
import { setCached, mintSessionId } from '../../lib/sessionCache';

function renderScreen() {
  // Fresh client per render (retries off) so tests don't share cache state.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <EventThemeProvider>
          <ConsentGateProvider>
            <PhotosScreen />
          </ConsentGateProvider>
        </EventThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

function findFab(root: any) {
  const pressNodes = root.findAll((n: any) => typeof n?.props?.onPress === 'function');
  return pressNodes[pressNodes.length - 1];
}

describe('app/(tabs)/photos', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiDelete.mockReset();
    await SecureStore.deleteItemAsync('consent_photo_upload');
    // Establish an active guest session scope so the photos `useQuery` is
    // enabled (it keys on the session scope and is disabled when signed out).
    await setCached('guest_token', 'guest-token');
    await setCached('guest_id', '99');
    await mintSessionId();
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
    expect(mockApiGet).toHaveBeenCalledWith('/api/photos', expect.anything());
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

    await act(async () => {
      fireEvent.press(findFab(UNSAFE_root));
    });

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    alertSpy.mockRestore();
  });

  it('FAB shows the consent modal before the upload alert when consent is missing', async () => {
    mockApiGet.mockResolvedValue({ data: { data: [] } });

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { UNSAFE_root, findByText } = renderScreen();

    await findByText('Noch keine Fotos');

    await act(async () => {
      fireEvent.press(findFab(UNSAFE_root));
    });

    // Modal-title copy for the consent gate.
    await findByText('Ich stimme zu');
    // Upload alert has NOT fired yet — the modal blocks it.
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('uploads the selected image as multipart photo and prepends the backend response', async () => {
    mockApiGet.mockResolvedValue({ data: { data: [] } });
    mockApiPost.mockResolvedValue({
      data: {
        id: 99,
        url: 'https://x/uploaded.jpg',
        guest_name: 'Ada',
        created_at: '2026-07-09T12:00:00.000000Z',
      },
    });
    await setCached('guest_id', '42');
    await SecureStore.setItemAsync(
      'consent_photo_upload',
      JSON.stringify({ granted_at: new Date().toISOString() })
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const formDataAppendSpy = jest.spyOn(FormData.prototype, 'append');

    const { UNSAFE_root, findByText, findByTestId } = renderScreen();
    await findByText('Noch keine Fotos');

    await act(async () => {
      fireEvent.press(findFab(UNSAFE_root));
    });
    const [, , buttons] = alertSpy.mock.calls[0] as any;
    const libraryButton = buttons.find((button: any) => button.text === 'Aus Bibliothek');

    await act(async () => {
      await libraryButton.onPress();
    });

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith(
        '/api/photos',
        expect.any(Object),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
          transformRequest: expect.any(Function),
        })
      )
    );
    const [, formData, options] = mockApiPost.mock.calls[0];
    expect(formDataAppendSpy).toHaveBeenCalledWith('photo', {
      uri: 'file:///tmp/fixture-library.jpg',
      name: 'photo.jpg',
      type: 'image/jpeg',
    });
    expect(options.transformRequest(formData)).toBe(formData);
    fireEvent.press(await findByTestId('photo-99'));
    await findByText('Ada');
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: false,
    });
    formDataAppendSpy.mockRestore();
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
    mockApiPost.mockResolvedValue({ data: { id: 9, status: 'pending', auto_hidden: true } });
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

  it('own photos show delete instead of report and hide actions', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            url: 'https://x/1.jpg',
            guest_id: 42,
            guest_name: 'Ada',
            created_at: '2026-06-01T00:00:00Z',
          },
        ],
      },
    });
    await SecureStore.setItemAsync('guest_token', 'test-token');
    await setCached('guest_id', '42');

    const { findByTestId, queryByTestId, queryByText } = renderScreen();
    fireEvent.press(await findByTestId('photo-1'));

    await findByTestId('delete-photo-button');
    expect(queryByTestId('report-photo-button')).toBeNull();
    expect(queryByText('Uploader ausblenden')).toBeNull();
  });

  it('delete confirm calls the guest delete endpoint and removes the photo locally', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            url: 'https://x/1.jpg',
            guest_id: 42,
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
    mockApiDelete.mockResolvedValue({ data: undefined });
    await SecureStore.setItemAsync('guest_token', 'test-token');
    await setCached('guest_id', '42');
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { findByTestId, queryByTestId } = renderScreen();
    fireEvent.press(await findByTestId('photo-1'));
    fireEvent.press(await findByTestId('delete-photo-button'));

    const [, , buttons] = alertSpy.mock.calls[0] as any;
    await act(async () => {
      await buttons[1].onPress();
    });

    await waitFor(() => expect(mockApiDelete).toHaveBeenCalledWith('/api/photos/1'));
    await waitFor(() => {
      expect(queryByTestId('photo-1')).toBeNull();
      expect(queryByTestId('photo-2')).not.toBeNull();
    });
    expect(alertSpy).toHaveBeenCalledWith('Foto gelöscht.');
    alertSpy.mockRestore();
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

  it('retries fetchPhotos when the error banner retry button is pressed', async () => {
    mockApiGet.mockImplementation(async (path: string) => {
      if (path === '/api/photos') return Promise.reject(new Error('boom'));
      return { data: {} };
    });

    const { findByText, findByTestId, queryByText } = renderScreen();
    await findByText('Daten konnten nicht geladen werden.');

    mockApiGet.mockImplementation(async (path: string) => {
      if (path === '/api/photos') {
        return {
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
        };
      }
      return { data: {} };
    });
    const retryButton = await findByTestId('error-banner-retry');
    await act(async () => {
      fireEvent.press(retryButton);
    });

    await findByTestId('photo-1');
    expect(queryByText('Daten konnten nicht geladen werden.')).toBeNull();
  });
});
