import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockGetManagementSession = jest.fn();
const mockFetchManagementEvents = jest.fn();
const mockEnsureActiveManagementEvent = jest.fn();
const mockSetActiveManagementEvent = jest.fn();
const mockClearManagementSession = jest.fn();
jest.mock('../../lib/management', () => ({
  __esModule: true,
  getManagementSession: (...args: any[]) => mockGetManagementSession(...args),
  fetchManagementEvents: (...args: any[]) => mockFetchManagementEvents(...args),
  ensureActiveManagementEvent: (...args: any[]) => mockEnsureActiveManagementEvent(...args),
  setActiveManagementEvent: (...args: any[]) => mockSetActiveManagementEvent(...args),
  clearManagementSession: (...args: any[]) => mockClearManagementSession(...args),
}));

const mockGetManagementPushEnabled = jest.fn();
const mockSetManagementPushEnabled = jest.fn();
const mockSyncManagementPushPreference = jest.fn();
jest.mock('../../lib/managementPush', () => ({
  __esModule: true,
  getManagementPushEnabled: (...args: any[]) => mockGetManagementPushEnabled(...args),
  setManagementPushEnabled: (...args: any[]) => mockSetManagementPushEnabled(...args),
  syncManagementPushPreference: (...args: any[]) => mockSyncManagementPushPreference(...args),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

import OrganizerHomeScreen from '../../app/organizer/index';
import { LanguageProvider } from '../../lib/LanguageContext';
import { EventThemeProvider } from '../../lib/EventThemeContext';

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <OrganizerHomeScreen />
      </EventThemeProvider>
    </LanguageProvider>
  );
}

describe('app/organizer/index', () => {
  beforeEach(() => {
    mockGetManagementSession.mockReset();
    mockFetchManagementEvents.mockReset();
    mockEnsureActiveManagementEvent.mockReset();
    mockSetActiveManagementEvent.mockReset();
    mockClearManagementSession.mockReset();
    mockGetManagementPushEnabled.mockReset().mockResolvedValue(false);
    mockSetManagementPushEnabled.mockReset().mockResolvedValue(true);
    mockSyncManagementPushPreference.mockReset().mockResolvedValue(false);
    (router.replace as jest.Mock).mockClear();
    mockGetManagementSession.mockResolvedValue({
      token: 't',
      id: 1,
      name: 'Ada Admin',
      email: 'ada@example.test',
    });
    mockFetchManagementEvents.mockResolvedValue([
      { id: 4, name: 'Wedding', date: null, my_role: 'owner' },
      { id: 5, name: 'Birthday', date: null, my_role: 'event_manager' },
    ]);
    mockEnsureActiveManagementEvent.mockResolvedValue(4);
  });

  it('renders accessible events with roles and switches the active event', async () => {
    const { findByText } = renderScreen();
    await findByText('Ada Admin');
    await findByText('Wedding');
    const second = await findByText('Birthday');

    fireEvent.press(second);
    await waitFor(() => expect(mockSetActiveManagementEvent).toHaveBeenCalledWith(5));
  });

  it('redirects to the shared welcome scanner without a session', async () => {
    mockGetManagementSession.mockResolvedValue(null);
    renderScreen();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(mockFetchManagementEvents).not.toHaveBeenCalled();
  });

  it('clears the organizer session on logout', async () => {
    const { findByLabelText } = renderScreen();
    fireEvent.press(await findByLabelText('Ausloggen'));

    await waitFor(() => expect(mockClearManagementSession).toHaveBeenCalled());
  });

  it('offers an explicit push opt-in toggle', async () => {
    const { findByLabelText } = renderScreen();
    fireEvent(await findByLabelText('Aufgaben-Benachrichtigungen'), 'valueChange', true);

    await waitFor(() => expect(mockSetManagementPushEnabled).toHaveBeenCalledWith(true));
  });
});
