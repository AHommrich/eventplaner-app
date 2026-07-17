import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockGetManagementSession = jest.fn();
const mockClearManagementSession = jest.fn();
jest.mock('../../lib/management', () => ({
  getManagementSession: (...args: any[]) => mockGetManagementSession(...args),
  clearManagementSession: (...args: any[]) => mockClearManagementSession(...args),
}));

const mockLoadTheme = jest.fn();
jest.mock('../../lib/EventThemeContext', () => ({
  useEventTheme: () => ({
    colors: {
      screenBg: '#fff7f4',
      primary: '#7f2633',
      card: '#ffffff',
      cardText: '#251f20',
      cardButton: '#7f2633',
      cardButtonText: '#ffffff',
      border: '#7f2633',
    },
    variant: {
      key: 'classic',
      radius: { button: 12 },
    },
    loadTheme: mockLoadTheme,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

import OrganizerSettingsScreen from '../../app/organizer/settings';
import { LanguageProvider } from '../../lib/LanguageContext';

function renderScreen() {
  return render(
    <LanguageProvider>
      <OrganizerSettingsScreen />
    </LanguageProvider>
  );
}

describe('app/organizer/settings', () => {
  beforeEach(() => {
    mockGetManagementSession.mockReset().mockResolvedValue({
      token: 'management-token',
      id: 7,
      name: 'Ada Admin',
      email: 'ada@example.test',
    });
    mockClearManagementSession.mockReset().mockResolvedValue(undefined);
    mockLoadTheme.mockReset().mockResolvedValue(undefined);
    (router.replace as jest.Mock).mockClear();
  });

  it('shows only generic app settings and organizer identity', async () => {
    const { findByText, queryByText } = renderScreen();

    await findByText('Ada Admin');
    await findByText('Impressum');
    await findByText('Datenschutzerklärung');
    expect(queryByText('Meine Daten exportieren')).toBeNull();
    expect(queryByText('Konto löschen')).toBeNull();
    expect(queryByText('Einwilligungen verwalten')).toBeNull();
    expect(queryByText('Ausgeblendete Gäste')).toBeNull();
  });

  it('queues revocation through management logout and clears the event theme', async () => {
    const { findByText } = renderScreen();
    fireEvent.press(await findByText('Ausloggen'));

    await waitFor(() => {
      expect(mockClearManagementSession).toHaveBeenCalledTimes(1);
      expect(mockLoadTheme).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith('/');
    });
  });
});
