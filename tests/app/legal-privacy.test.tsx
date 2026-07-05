/**
 * `app/legal/privacy.tsx` — in-app Art. 13 privacy notice.
 *
 * Three states are meaningful:
 *   - fetch succeeds → sections render with the update-timestamp header.
 *   - fetch fails → offline card with "open in browser" + retry button.
 *   - retry after failure re-runs the fetch.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockFetchPrivacyNotice = jest.fn();
jest.mock('../../lib/legal', () => {
  const actual = jest.requireActual('../../lib/legal');
  return {
    __esModule: true,
    ...actual,
    fetchPrivacyNotice: (...a: any[]) => mockFetchPrivacyNotice(...a),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) };
});

import PrivacyScreen from '../../app/legal/privacy';
import { LanguageProvider } from '../../lib/LanguageContext';
import { EventThemeProvider } from '../../lib/EventThemeContext';

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <PrivacyScreen />
      </EventThemeProvider>
    </LanguageProvider>,
  );
}

describe('app/legal/privacy', () => {
  beforeEach(() => {
    mockFetchPrivacyNotice.mockReset();
  });

  it('renders every section returned by the backend', async () => {
    mockFetchPrivacyNotice.mockResolvedValue({
      locale: 'de',
      updated_at: '2026-06-01T00:00:00Z',
      sections: [
        { id: 's1', heading: 'Verantwortlicher', body_markdown: 'André & Tabea …' },
        { id: 's2', heading: 'Deine Rechte', body_markdown: 'Auskunft, Löschung …' },
      ],
    });

    const { findByText } = renderScreen();
    await findByText('Verantwortlicher');
    await findByText('André & Tabea …');
    await findByText('Deine Rechte');
  });

  it('surfaces the offline card when the fetch rejects', async () => {
    mockFetchPrivacyNotice.mockRejectedValue(new Error('offline'));

    const { findByText } = renderScreen();
    await findByText('Nicht verfügbar');
    // The retry button is present.
    await findByText('Erneut versuchen');
  });

  it('retry re-runs `fetchPrivacyNotice` and swaps into the loaded state', async () => {
    // Persistent reject — the LanguageProvider's async initial-load causes
    // a second `load()` call during mount, so a `.mockRejectedValueOnce`
    // would prematurely fall through to the resolved value before the
    // guest ever sees the offline card.
    mockFetchPrivacyNotice.mockRejectedValue(new Error('offline'));

    const { findByText } = renderScreen();
    const retry = await findByText('Erneut versuchen');

    // Swap to a resolving impl before the retry press so only the third
    // call — the one triggered by the tap — takes the loaded branch.
    mockFetchPrivacyNotice.mockResolvedValue({
      locale: 'de',
      updated_at: '2026-06-01T00:00:00Z',
      sections: [{ id: 's1', heading: 'Once online', body_markdown: '…' }],
    });

    fireEvent.press(retry);

    await findByText('Once online');
  });
});
