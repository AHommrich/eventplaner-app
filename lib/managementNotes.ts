import api from './api';

export type ManagementNoteType = 'note' | 'todo';

export type ManagementNote = {
  id: number;
  type: ManagementNoteType;
  title: string;
  body: string | null;
  is_done: boolean;
  done_at: string | null;
  author_name: string;
  assignee_user_id: number | null;
  assignee_name: string | null;
  created_at: string;
};

export type ManagementNoteAssignee = {
  id: number;
  name: string;
};

export type ManagementNotesPayload = {
  personal: ManagementNote[];
  assigned_to_me: ManagementNote[];
  assigned_team: ManagementNote[];
  can_assign: boolean;
  managers: ManagementNoteAssignee[];
};

export type CreateManagementNote = {
  type: ManagementNoteType;
  title: string;
  body?: string | null;
  assignee_user_id?: number | null;
};

export async function fetchManagementNotes(signal?: AbortSignal): Promise<ManagementNotesPayload> {
  const response = await api.get<ManagementNotesPayload>('/api/management/notes', { signal });
  return response.data;
}

export async function createManagementNote(input: CreateManagementNote): Promise<ManagementNote> {
  const response = await api.post<{ note: ManagementNote }>('/api/management/notes', input);
  return response.data.note;
}

export async function setManagementNoteDone(
  noteId: number,
  isDone: boolean
): Promise<ManagementNote> {
  const response = await api.patch<{ note: ManagementNote }>(`/api/management/notes/${noteId}`, {
    is_done: isDone,
  });
  return response.data.note;
}

export async function deleteManagementNote(noteId: number): Promise<void> {
  await api.delete(`/api/management/notes/${noteId}`);
}
