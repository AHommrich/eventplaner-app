import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockGetActiveManagementEventId = jest.fn();
jest.mock('../../lib/management', () => ({
  __esModule: true,
  getActiveManagementEventId: (...args: any[]) => mockGetActiveManagementEventId(...args),
}));

const mockFetchManagementNotes = jest.fn();
const mockCreateManagementNote = jest.fn();
const mockSetManagementNoteDone = jest.fn();
const mockDeleteManagementNote = jest.fn();
jest.mock('../../lib/managementNotes', () => ({
  __esModule: true,
  fetchManagementNotes: (...args: any[]) => mockFetchManagementNotes(...args),
  createManagementNote: (...args: any[]) => mockCreateManagementNote(...args),
  setManagementNoteDone: (...args: any[]) => mockSetManagementNoteDone(...args),
  deleteManagementNote: (...args: any[]) => mockDeleteManagementNote(...args),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

import OrganizerNotesScreen from '../../app/organizer/notes';
import { EventThemeProvider } from '../../lib/EventThemeContext';
import { LanguageProvider } from '../../lib/LanguageContext';
import { setCached, mintSessionId } from '../../lib/sessionCache';

/** Establish an active management session scope bound to one event. */
async function loginManagement() {
  await setCached('management_token', 'm');
  await setCached('management_user_id', '7');
  await setCached('management_active_event_id', '4');
  await mintSessionId();
}

const todo = {
  id: 12,
  type: 'todo',
  title: 'Stühle aufstellen',
  body: null,
  is_done: false,
  done_at: null,
  author_name: 'Ada',
  assignee_user_id: 7,
  assignee_name: 'Max Manager',
  created_at: '2026-07-17T12:00:00Z',
};

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <OrganizerNotesScreen />
      </EventThemeProvider>
    </LanguageProvider>
  );
}

describe('app/organizer/notes', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (globalThis as any).__routerParams = {};
    await loginManagement();
    mockGetActiveManagementEventId.mockResolvedValue(4);
    mockFetchManagementNotes.mockResolvedValue({
      personal: [],
      assigned_to_me: [todo],
      assigned_team: [],
      can_assign: true,
      managers: [{ id: 7, name: 'Max Manager' }],
    });
    mockCreateManagementNote.mockResolvedValue(todo);
    mockSetManagementNoteDone.mockResolvedValue({ ...todo, is_done: true });
  });

  it('lists assigned work and lets the assignee complete a todo', async () => {
    const { findByText, findByLabelText } = renderScreen();

    await findByText('Stühle aufstellen');
    fireEvent.press(await findByLabelText('Als erledigt markieren'));

    await waitFor(() => expect(mockSetManagementNoteDone).toHaveBeenCalledWith(12, true));
  });

  it('creates a todo for a selected event manager', async () => {
    const { findByText, findByLabelText } = renderScreen();

    fireEvent.press(await findByText('Max Manager'));
    fireEvent.changeText(await findByLabelText('Titel'), 'Getränke kühlen');
    fireEvent.changeText(await findByLabelText('Beschreibung (optional)'), 'Bis 16 Uhr');
    fireEvent.press(await findByText('Speichern'));

    await waitFor(() =>
      expect(mockCreateManagementNote).toHaveBeenCalledWith({
        type: 'todo',
        title: 'Getränke kühlen',
        body: 'Bis 16 Uhr',
        assignee_user_id: 7,
      })
    );
  });

  it('returns to event selection when no active event exists', async () => {
    // No management scope → redirect home, no notes fetch.
    const { _resetForTests } = require('../../lib/sessionCache');
    _resetForTests();
    renderScreen();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/organizer'));
    expect(mockFetchManagementNotes).not.toHaveBeenCalled();
  });

  it('highlights the note opened from an assignment notification', async () => {
    (globalThis as any).__routerParams = { noteId: '12' };
    const { findByText, findAllByText } = renderScreen();

    await findByText('Neu zugewiesene Aufgabe');
    await expect(findAllByText('Stühle aufstellen')).resolves.toHaveLength(2);
  });
});
