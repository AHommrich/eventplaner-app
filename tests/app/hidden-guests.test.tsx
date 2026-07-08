/**
 * `app/hidden-guests.tsx` — manages one-sided guest content hides.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockApiGet = jest.fn();
const mockApiDelete = jest.fn();
jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: {
    get: (...a: any[]) => mockApiGet(...a),
    delete: (...a: any[]) => mockApiDelete(...a),
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) };
});

import HiddenGuestsScreen from '../../app/hidden-guests';
import { LanguageProvider } from '../../lib/LanguageContext';
import { EventThemeProvider } from '../../lib/EventThemeContext';

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <HiddenGuestsScreen />
      </EventThemeProvider>
    </LanguageProvider>
  );
}

describe('app/hidden-guests', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiDelete.mockReset();
  });

  it('fetches hidden guests on mount and renders the empty state', async () => {
    mockApiGet.mockResolvedValue({ data: { hidden_guests: [] } });

    const { findByText } = renderScreen();
    await findByText('Du blendest aktuell niemanden aus.');
    expect(mockApiGet).toHaveBeenCalledWith('/api/guests/hidden-content');
  });

  it('unhide removes the row locally after DELETE', async () => {
    mockApiGet.mockResolvedValue({
      data: { hidden_guests: [{ id: 11, firstname: 'Ada', lastname: 'Lovelace' }] },
    });
    mockApiDelete.mockResolvedValue({ data: undefined });

    const { findByText, queryByText } = renderScreen();
    await findByText('Ada Lovelace');
    fireEvent.press(await findByText('Wieder einblenden'));

    await waitFor(() => expect(mockApiDelete).toHaveBeenCalledWith('/api/guests/11/hide-content'));
    await waitFor(() => expect(queryByText('Ada Lovelace')).toBeNull());
  });
});
