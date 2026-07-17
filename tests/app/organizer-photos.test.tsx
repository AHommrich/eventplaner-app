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
jest.mock('../../lib/managementPhotos', () => ({
  __esModule: true,
  fetchManagementPhotos: (...args: any[]) => mockFetchManagementPhotos(...args),
  deleteManagementPhoto: (...args: any[]) => mockDeleteManagementPhoto(...args),
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
    ]);
    mockDeleteManagementPhoto.mockResolvedValue(undefined);
  });

  it('renders every gallery and permanently deletes a confirmed photo', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const destructive = buttons?.find((button) => button.style === 'destructive');
      void destructive?.onPress?.();
    });
    const { findByText, findByLabelText, queryByText } = renderScreen();

    await findByText('Präsentation');
    await findByText('Greta Gast');
    fireEvent.press(await findByLabelText('Foto löschen'));

    await waitFor(() => expect(mockDeleteManagementPhoto).toHaveBeenCalledWith(9));
    await waitFor(() => expect(queryByText('Greta Gast')).toBeNull());
    alert.mockRestore();
  });

  it('returns to event selection when no active event exists', async () => {
    mockGetActiveManagementEventId.mockResolvedValue(null);
    renderScreen();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/organizer'));
    expect(mockFetchManagementPhotos).not.toHaveBeenCalled();
  });
});
