jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import api from '../../lib/api';
import {
  createManagementNote,
  deleteManagementNote,
  fetchManagementNotes,
  setManagementNoteDone,
} from '../../lib/managementNotes';

const mockedApi = api as jest.Mocked<typeof api>;

describe('management notes API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads the visible note groups for the active event', async () => {
    const payload = {
      personal: [],
      assigned_to_me: [],
      assigned_team: [],
      can_assign: false,
      managers: [],
    };
    mockedApi.get.mockResolvedValue({ data: payload });

    await expect(fetchManagementNotes()).resolves.toEqual(payload);
    expect(mockedApi.get).toHaveBeenCalledWith('/api/management/notes', { signal: undefined });
  });

  it('creates, completes, and deletes notes through management routes', async () => {
    const note = { id: 12, title: 'Chairs', is_done: false };
    mockedApi.post.mockResolvedValue({ data: { note } });
    mockedApi.patch.mockResolvedValue({ data: { note: { ...note, is_done: true } } });
    mockedApi.delete.mockResolvedValue({ data: undefined });

    await expect(
      createManagementNote({ type: 'todo', title: 'Chairs', assignee_user_id: 7 })
    ).resolves.toEqual(note);
    expect(mockedApi.post).toHaveBeenCalledWith('/api/management/notes', {
      type: 'todo',
      title: 'Chairs',
      assignee_user_id: 7,
    });

    await expect(setManagementNoteDone(12, true)).resolves.toMatchObject({ is_done: true });
    expect(mockedApi.patch).toHaveBeenCalledWith('/api/management/notes/12', { is_done: true });

    await deleteManagementNote(12);
    expect(mockedApi.delete).toHaveBeenCalledWith('/api/management/notes/12');
  });
});
