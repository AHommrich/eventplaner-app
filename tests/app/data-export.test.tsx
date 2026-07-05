/**
 * `app/data-export.tsx` — Art. 15 GDPR data-export screen.
 *
 * Tests focus on:
 *   - Data loads on mount and every section card renders.
 *   - Copy-JSON button writes to the clipboard.
 *   - Error state surfaces the retry button which re-runs `exportMyData`.
 */
import React from 'react';
import * as Clipboard from 'expo-clipboard';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockExportMyData = jest.fn();
jest.mock('../../lib/guest', () => {
  const actual = jest.requireActual('../../lib/guest');
  return { __esModule: true, ...actual, exportMyData: (...a: any[]) => mockExportMyData(...a) };
});

// `expo-clipboard` isn't in the shared setup — this screen is its only
// consumer, so the mock lives locally.
jest.mock('expo-clipboard', () => ({
  __esModule: true,
  setStringAsync: jest.fn(async () => true),
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) };
});

import DataExportScreen from '../../app/data-export';
import { LanguageProvider } from '../../lib/LanguageContext';
import { EventThemeProvider } from '../../lib/EventThemeContext';

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <DataExportScreen />
      </EventThemeProvider>
    </LanguageProvider>
  );
}

const samplePayload = {
  format_version: 1,
  generated_at: '2026-06-01T12:00:00Z',
  guest: { id: 1, firstname: 'Ada', lastname: 'L' },
  family_members: [],
  photos: [],
  drink_logs: [],
  photo_game_submission: null,
};

describe('app/data-export', () => {
  beforeEach(() => {
    mockExportMyData.mockReset();
    (Clipboard.setStringAsync as jest.Mock).mockClear();
  });

  it('renders every section header once the fetch resolves', async () => {
    mockExportMyData.mockResolvedValue(samplePayload);

    const { findByText } = renderScreen();
    // Section titles are locale strings — check a subset.
    await findByText('Deine Person');
    await findByText('Familienmitglieder');
    await findByText('Deine Fotos');
    await findByText(/Erstellt am/);
  });

  it('copy-JSON button writes the serialised payload to the clipboard', async () => {
    mockExportMyData.mockResolvedValue(samplePayload);

    const { findByText } = renderScreen();
    const copy = await findByText('JSON in Zwischenablage kopieren');

    fireEvent.press(copy);

    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalled());
    // The clipboard call receives a pretty-printed JSON string that includes
    // the guest identity from the payload.
    const written = (Clipboard.setStringAsync as jest.Mock).mock.calls[0][0];
    expect(written).toContain('"firstname": "Ada"');
  });

  it('error state renders a retry button that re-runs the fetch', async () => {
    mockExportMyData.mockRejectedValue(new Error('offline'));

    const { findByText } = renderScreen();
    const retry = await findByText('Erneut versuchen');

    // Prep a resolving response for the retry press.
    mockExportMyData.mockResolvedValue(samplePayload);
    fireEvent.press(retry);

    await findByText('Deine Person');
  });
});
