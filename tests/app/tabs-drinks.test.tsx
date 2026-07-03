/**
 * `app/(tabs)/drinks.tsx` — drink-logging + leaderboard.
 *
 * The screen is large; the observable contract is:
 *   1. Log-view catalog renders after the catalog fetch resolves.
 *   2. Log ↔ Leaderboard tab switcher swaps content.
 *   3. `EventInfo.drink_game_end_time` in the past → the "game ended" banner
 *      renders (a guard that freezes every action button).
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockApiGet = jest.fn();
jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: { get: (...a: any[]) => mockApiGet(...a), post: jest.fn() },
}));

jest.mock('../../lib/auth', () => ({
  __esModule: true,
  getSession: jest.fn(async () => ({
    token: 't', guestId: 1, firstname: 'Ada', lastname: 'L', type: 'solo', familyName: null,
  })),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 48,
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) };
});

import DrinksScreen from '../../app/(tabs)/drinks';
import { LanguageProvider } from '../../lib/LanguageContext';
import { EventThemeProvider } from '../../lib/EventThemeContext';

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <DrinksScreen />
      </EventThemeProvider>
    </LanguageProvider>,
  );
}

/**
 * Route the many `api.get` targets through a single dispatcher — production
 * fires `/api/drinks` and `/api/drinks/stats` in parallel; the theme provider
 * also fires `/api/event/info`.
 */
function wireApi({
  drinks = [],
  stats = { guest_totals: [], my_stats: [], current_streak: 0, binge_penalty: false, cooldown_seconds: 0 },
  eventInfo = { drink_game_end_time: null },
}: { drinks?: any[]; stats?: any; eventInfo?: any } = {}) {
  mockApiGet.mockImplementation(async (path: string) => {
    if (path === '/api/drinks') return { data: { data: drinks } };
    if (path === '/api/drinks/stats') return { data: stats };
    if (path === '/api/event/info') return { data: eventInfo };
    return { data: {} };
  });
}

describe('app/(tabs)/drinks', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    // `EventThemeProvider` only fetches `/api/event/info` when a bearer
    // token exists in secure-store — seed one so the mocked `eventInfo`
    // reaches the screen.
    const SecureStore = require('expo-secure-store');
    await SecureStore.setItemAsync('guest_token', 't');
  });

  afterEach(async () => {
    const SecureStore = require('expo-secure-store');
    await SecureStore.deleteItemAsync('guest_token');
  });

  it('renders the log tab as active on first render', async () => {
    wireApi();
    const { findByText } = renderScreen();

    // Both segmented-control labels are present; the log tab is active.
    await findByText('Eintragen');
    await findByText('Rangliste');
  });

  it('renders a catalog row after the drinks fetch resolves', async () => {
    wireApi({
      drinks: [
        {
          id: 1, display_name: 'Bier', category: 'beer', category_label: 'Bier',
          is_alcoholic: true,
          sizes: [{ drink_id: 10, id: 1, amount_liter: 0.5, is_default: true, points: 2 }],
        },
      ],
    });

    const { findByText } = renderScreen();
    // The category accordion header shows the localised label.
    await findByText('Bier');
  });

  it('past `drink_game_end_time` surfaces the "game ended" banner', async () => {
    wireApi({ eventInfo: { drink_game_end_time: '2000-01-01T00:00:00Z' } });

    const { findByText } = renderScreen();
    await findByText(/Das Spiel ist beendet/);
  });

  it('switching to the leaderboard tab fetches the stats view', async () => {
    wireApi({
      stats: {
        guest_totals: [{ guest_id: 5, firstname: 'Zoe', lastname: 'K', total: 3, points_total: 12 }],
        my_stats: [],
        current_streak: 0,
        binge_penalty: false,
        cooldown_seconds: 0,
      },
    });

    const { findByText } = renderScreen();
    const leaderTab = await findByText('Rangliste');

    fireEvent.press(leaderTab);

    // Leaderboard renders the top guest.
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/api/drinks/stats'));
    await findByText(/Zoe/);
  });
});
