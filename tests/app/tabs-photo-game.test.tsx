/**
 * `app/(tabs)/photo-game.tsx` — 4-state photo-scavenger FSM.
 *
 * Tests one render per state (ended, no_assignment, assigned, submitted)
 * plus the assign-task action for the "no_assignment → assigned" transition.
 */
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockFetchPhotoGameStatus = jest.fn();
const mockAssignPhotoGameTask = jest.fn();
jest.mock('../../lib/guest', () => {
  const actual = jest.requireActual('../../lib/guest');
  return {
    __esModule: true,
    ...actual,
    fetchPhotoGameStatus: (...a: any[]) => mockFetchPhotoGameStatus(...a),
    assignPhotoGameTask: (...a: any[]) => mockAssignPhotoGameTask(...a),
    submitPhotoGamePhoto: jest.fn(),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) };
});

import PhotoGameScreen from '../../app/(tabs)/photo-game';
import { LanguageProvider } from '../../lib/LanguageContext';
import { EventThemeProvider } from '../../lib/EventThemeContext';
import { ConsentGateProvider } from '../../components/ConsentGate';

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <ConsentGateProvider>
          <PhotoGameScreen />
        </ConsentGateProvider>
      </EventThemeProvider>
    </LanguageProvider>,
  );
}

describe('app/(tabs)/photo-game', () => {
  beforeEach(() => {
    mockFetchPhotoGameStatus.mockReset();
    mockAssignPhotoGameTask.mockReset();
  });

  it('ended state renders the "game over" card', async () => {
    mockFetchPhotoGameStatus.mockResolvedValue({ status: 'ended', assignment: null });

    const { findByText } = renderScreen();
    await findByText('Das Spiel ist beendet.');
  });

  it('no_assignment state renders the "get task" CTA', async () => {
    mockFetchPhotoGameStatus.mockResolvedValue({ status: 'active', assignment: null });

    const { findByText } = renderScreen();
    await findByText('Aufgabe erhalten');
  });

  it('assigned state renders the task text and upload button', async () => {
    mockFetchPhotoGameStatus.mockResolvedValue({
      status: 'active',
      assignment: { id: 7, task: { id: 3, description: 'Take a selfie with the couple' }, submitted_at: null, photo_url: null },
    });

    const { findByText } = renderScreen();
    await findByText('Take a selfie with the couple');
    await findByText('Foto hochladen');
  });

  it('submitted state renders the "submitted" title and replace button', async () => {
    mockFetchPhotoGameStatus.mockResolvedValue({
      status: 'active',
      assignment: {
        id: 7,
        task: { id: 3, description: 'Take a selfie with the couple' },
        submitted_at: '2026-06-01T00:00:00Z',
        photo_url: 'https://x/1.jpg',
      },
    });

    const { findByText } = renderScreen();
    await findByText('Eingereicht! 🎉');
    await findByText('Foto ersetzen');
  });

  it('tapping "get task" calls `assignPhotoGameTask` and swaps to the assigned card', async () => {
    mockFetchPhotoGameStatus.mockResolvedValue({ status: 'active', assignment: null });
    mockAssignPhotoGameTask.mockResolvedValue({
      id: 7,
      task: { id: 3, description: 'Fresh task description' },
    });

    const { findByText } = renderScreen();
    const cta = await findByText('Aufgabe erhalten');

    await act(async () => {
      fireEvent.press(cta);
    });

    await waitFor(() => expect(mockAssignPhotoGameTask).toHaveBeenCalled());
    await findByText('Fresh task description');
  });
});
