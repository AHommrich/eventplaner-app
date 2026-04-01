import api from './api';

export type RsvpStatus =
  | null
  | 'accepted_pending'
  | 'accepted'
  | 'declined_pending'
  | 'declined'
  | 'revocation_requested';

export type GroupMember = {
  guest_id: number;
  firstname: string;
  lastname: string;
  rsvp_status: RsvpStatus;
  rsvp_set_by: { guest_id: number; firstname: string; lastname: string } | null;
};

export type GuestMe = {
  guest_id: number;
  firstname: string;
  lastname: string;
  type: 'solo' | 'family';
  family_name: string | null;
  rsvp_status: RsvpStatus;
  rsvp_set_by: { guest_id: number; firstname: string; lastname: string } | null;
  group_members: GroupMember[];
};

export type EventInfo = {
  name: string;
  date: string;
  rsvp_deadline: string;
  cover_image_url: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  venue_display_mode: 'address' | 'name' | 'both';
  dresscode: string | null;
  schedule: string | null;
  // Palette
  color_primary: string | null;
  color_secondary: string | null;
  color_tertiary: string | null;
  // aufgelöste Rollen
  color_screen_bg: string | null;
  color_card: string | null;
  color_card_text: string | null;
  color_card_button: string | null;
  color_card_button_text: string | null;
  color_tab_tint: string | null;
  color_border: string | null;
  color_fab: string | null;
  color_fab_icon: string | null;
  color_home_text: string | null;
  color_home_shadow: string;
  home_shadow_opacity: number;
  drink_game_enabled: boolean;
  drink_game_end_time: string | null;
  photo_game_enabled: boolean;
  font_heading: string | null;
};

export function isFullAccess(status: RsvpStatus): boolean {
  return status === 'accepted_pending' || status === 'accepted';
}

export function isDeclinedFlow(status: RsvpStatus): boolean {
  return (
    status === 'declined_pending' ||
    status === 'declined' ||
    status === 'revocation_requested'
  );
}

export async function fetchGuestMe(): Promise<GuestMe> {
  const res = await api.get<GuestMe>('/api/guest/me');
  return res.data;
}

export async function fetchEventInfo(): Promise<EventInfo> {
  const res = await api.get<EventInfo>('/api/event/info');
  return res.data;
}

export async function postRsvp(attending: boolean): Promise<RsvpStatus> {
  const res = await api.post<{ rsvp_status: RsvpStatus }>('/api/guest/rsvp', { attending });
  return res.data.rsvp_status;
}

export async function postGroupRsvp(
  guestId: number,
  attending: boolean,
): Promise<{ guest_id: number; rsvp_status: RsvpStatus }> {
  const res = await api.post<{ guest_id: number; rsvp_status: RsvpStatus }>(
    `/api/guest/${guestId}/rsvp`,
    { attending },
  );
  return res.data;
}

export type PhotoGameStatus = 'draft' | 'active' | 'ended';

export type PhotoGameAssignment = {
  id: number;
  task: { id: number; description: string };
  submitted_at: string | null;
  photo_url: string | null;
};

export type PhotoGameStatusResponse = {
  status: PhotoGameStatus;
  assignment: PhotoGameAssignment | null;
};

export async function fetchPhotoGameStatus(): Promise<PhotoGameStatusResponse> {
  const res = await api.get<PhotoGameStatusResponse>('/api/game/photo/status');
  return res.data;
}

export async function assignPhotoGameTask(): Promise<{ id: number; task: { id: number; description: string } }> {
  const res = await api.post('/api/game/photo/assign');
  return res.data;
}

export async function submitPhotoGamePhoto(photoUri: string): Promise<{ photo_url: string; submitted_at: string }> {
  const formData = new FormData();
  formData.append('photo', { uri: photoUri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  const res = await api.post('/api/game/photo/submit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (data) => data,
  });
  return res.data;
}

export async function postRevoke(): Promise<RsvpStatus> {
  const res = await api.post<{ rsvp_status: RsvpStatus }>('/api/guest/rsvp/revoke');
  return res.data.rsvp_status;
}
