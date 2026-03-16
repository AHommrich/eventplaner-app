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
  dresscode: string | null;
  schedule: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  color_home_text: string | null;
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

export async function postRevoke(): Promise<RsvpStatus> {
  const res = await api.post<{ rsvp_status: RsvpStatus }>('/api/guest/rsvp/revoke');
  return res.data.rsvp_status;
}
