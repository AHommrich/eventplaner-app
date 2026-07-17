import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockGetActiveManagementEventId = jest.fn();
jest.mock('../../lib/management', () => ({
  __esModule: true,
  getActiveManagementEventId: (...args: any[]) => mockGetActiveManagementEventId(...args),
}));

const mockFetchManagementPhotos = jest.fn();
const mockDeleteManagementPhoto = jest.fn();
const mockUploadManagementPhoto = jest.fn();
jest.mock('../../lib/managementPhotos', () => ({
  __esModule: true,
  fetchManagementPhotos: (...args: any[]) => mockFetchManagementPhotos(...args),
  deleteManagementPhoto: (...args: any[]) => mockDeleteManagementPhoto(...args),
  uploadManagementPhoto: (...args: any[]) => mockUploadManagementPhoto(...args),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

import OrganizerPhotosScreen from '../../app/organizer/photos';
import { EventThemeProvider } from '../../lib/EventThemeContext';
import { LanguageProvider } from '../../lib/LanguageContext';

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <OrganizerPhotosScreen />
      </EventThemeProvider>
    </LanguageProvider>
  );
}

describe('app/organizer/photos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActiveManagementEventId.mockResolvedValue(4);
    mockFetchManagementPhotos.mockResolvedValue([
      {
        id: 1,
        slug: 'app_gallery',
        name: 'App-Galerie',
        sort_order: 1,
        photos: [],
      },
      {
        id: 2,
        slug: 'presentation',
        name: 'Präsentation',
        sort_order: 2,
        photos: [
          {
            id: 9,
            url: 'https://example.test/photo.jpg',
            guest_name: 'Greta Gast',
            uploaded_by: null,
            uploader_role: 'guest',
            description: 'Tanzfläche',
            task_description: null,
            created_at: '2026-07-17T12:00:00Z',
          },
        ],
      },
      {
        id: 3,
        slug: 'photo_game',
        name: 'Foto-Spiel',
        sort_order: 3,
        photos: [],
      },
    ]);
    mockDeleteManagementPhoto.mockResolvedValue(undefined);
    mockUploadManagementPhoto.mockResolvedValue(undefined);
  });

  it('renders every gallery and permanently deletes a confirmed photo', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const destructive = buttons?.find((button) => button.style === 'destructive');
      void destructive?.onPress?.();
    });
    const { findByText, findByLabelText, findByTestId, queryByText } = renderScreen();

    await findByText('Präsentation');
    await findByText('Foto-Spiel');
    fireEvent.press(await findByText('Präsentation'));
    fireEvent.press(await findByTestId('photo-9'));
    await findByLabelText('Foto schließen');
    fireEvent.press(await findByLabelText('Foto löschen'));

    await waitFor(() => expect(mockDeleteManagementPhoto).toHaveBeenCalledWith(9));
    await waitFor(() => expect(queryByText('Greta Gast')).toBeNull());
    alert.mockRestore();
  });

  it('uploads to valid albums and never offers a generic photo-game upload', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { findByText, findByLabelText, queryByLabelText } = renderScreen();

    fireEvent.press(await findByText('Präsentation'));
    fireEvent.press(await findByLabelText('Foto hochladen'));
    const [, , buttons] = alert.mock.calls[0] as any;
    const library = buttons.find((button: any) => button.text === 'Aus Bibliothek');
    await library.onPress();

    await waitFor(() =>
      expect(mockUploadManagementPhoto).toHaveBeenCalledWith(
        2,
        'file:///tmp/fixture-library.jpg',
        expect.any(Function)
      )
    );

    fireEvent.press(await findByText('Foto-Spiel'));
    expect(queryByLabelText('Foto hochladen')).toBeNull();
    await findByText(/nur über eine Aufgabe hochgeladen/);
    alert.mockRestore();
  });

  it('returns to event selection when no active event exists', async () => {
    mockGetActiveManagementEventId.mockResolvedValue(null);
    renderScreen();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/organizer'));
    expect(mockFetchManagementPhotos).not.toHaveBeenCalled();
  });
});
