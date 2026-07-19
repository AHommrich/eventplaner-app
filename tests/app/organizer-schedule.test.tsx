import React from 'react';
import { render } from '@testing-library/react-native';

const mockFetchManagementSchedule = jest.fn();
jest.mock('../../lib/managementSchedule', () => ({
  fetchManagementSchedule: (...args: any[]) => mockFetchManagementSchedule(...args),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

import OrganizerScheduleScreen from '../../app/organizer/schedule';
import { EventThemeProvider } from '../../lib/EventThemeContext';
import { LanguageProvider } from '../../lib/LanguageContext';

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <OrganizerScheduleScreen />
      </EventThemeProvider>
    </LanguageProvider>
  );
}

describe('app/organizer/schedule', () => {
  beforeEach(async () => {
    const { setCached, mintSessionId } = require('../../lib/sessionCache');
    await setCached('management_token', 'm');
    await setCached('management_user_id', '7');
    await setCached('management_active_event_id', '4');
    await mintSessionId();
    mockFetchManagementSchedule.mockReset().mockResolvedValue({
      date: '2099-06-01',
      schedule: null,
      schedule_stations: [
        {
          id: 1,
          title: 'Team-only setup',
          starts_at: '09:00',
          ends_at: '10:00',
          location_name: null,
          address: null,
          lat: null,
          lng: null,
        },
        {
          id: 2,
          title: 'Guest ceremony',
          starts_at: '14:00',
          ends_at: '15:00',
          location_name: null,
          address: null,
          lat: null,
          lng: null,
        },
      ],
    });
  });

  it('renders the complete management schedule through the shared timeline', async () => {
    const { findByText } = renderScreen();

    await findByText('Team-only setup');
    await findByText('Guest ceremony');
    expect(mockFetchManagementSchedule).toHaveBeenCalledTimes(1);
  });
});
