/**
 * `app/legal/imprint.tsx` — in-app § 5 DDG imprint.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockFetchImprint = jest.fn();
jest.mock('../../lib/legal', () => {
  const actual = jest.requireActual('../../lib/legal');
  return {
    __esModule: true,
    ...actual,
    fetchImprint: (...a: any[]) => mockFetchImprint(...a),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) };
});

import ImprintScreen from '../../app/legal/imprint';
import { LanguageProvider } from '../../lib/LanguageContext';
import { EventThemeProvider } from '../../lib/EventThemeContext';

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <ImprintScreen />
      </EventThemeProvider>
    </LanguageProvider>
  );
}

describe('app/legal/imprint', () => {
  beforeEach(() => {
    mockFetchImprint.mockReset();
  });

  it('renders every section returned by the backend', async () => {
    mockFetchImprint.mockResolvedValue({
      locale: 'de',
      updated_at: '2026-06-01T00:00:00Z',
      sections: [
        { id: 'provider', heading: 'Anbieter', body_markdown: 'André Hommrich' },
        { id: 'contact', heading: 'Kontakt', body_markdown: 'support@eveplan.de' },
      ],
    });

    const { findByText } = renderScreen();
    await findByText('Anbieter');
    await findByText('André Hommrich');
    await findByText('Kontakt');
  });

  it('surfaces the offline card when the fetch rejects', async () => {
    mockFetchImprint.mockRejectedValue(new Error('offline'));

    const { findByText } = renderScreen();
    await findByText('Nicht verfügbar');
    await findByText('Erneut versuchen');
  });

  it('retry re-runs `fetchImprint` and swaps into the loaded state', async () => {
    mockFetchImprint.mockRejectedValue(new Error('offline'));

    const { findByText } = renderScreen();
    const retry = await findByText('Erneut versuchen');

    mockFetchImprint.mockResolvedValue({
      locale: 'de',
      updated_at: '2026-06-01T00:00:00Z',
      sections: [{ id: 'online', heading: 'Wieder online', body_markdown: '…' }],
    });

    fireEvent.press(retry);

    await findByText('Wieder online');
  });
});
