/**
 * Typed HTTP wrappers around the guest-facing endpoints.
 *
 * Every function here does exactly one thing: type the request/response shape
 * so consumer screens don't juggle `any`. The bearer token is attached by the
 * axios request interceptor in `./api` — nothing in this file needs to know
 * about auth.
 *
 * The RSVP state machine (backend-driven) uses six values:
 *   - `null` .................. never answered, first-time login → onboarding RSVP
 *   - `accepted_pending` ...... accepted, not yet confirmed by the couple
 *   - `accepted` .............. accepted + confirmed → full app access
 *   - `declined_pending` ...... just declined, cooling-off window before final
 *   - `declined` .............. final decline → limited access (revocation only)
 *   - `revocation_requested` .. asked the couple to reverse a decline; waits
 *                                for a couple-side approval that flips back
 *                                to `accepted_pending`.
 *
 * `isFullAccess()` and `isDeclinedFlow()` centralise the two "which screens do
 * I show?" questions so tab-bar and redirect logic stays consistent.
 */
import api from './api';

// --- RSVP + guest identity types ---

export type RsvpStatus =
  | null
  | 'accepted_pending'
  | 'accepted'
  | 'declined_pending'
  | 'declined'
  | 'revocation_requested';

/**
 * One member of a family group as returned inside `GuestMe.group_members`.
 * `rsvp_set_by` names the family member who submitted the RSVP on behalf of
 * this guest — used to show "Deine Absage wurde von … eingetragen" hints.
 */
export type GroupMember = {
  guest_id: number;
  firstname: string;
  lastname: string;
  rsvp_status: RsvpStatus;
  rsvp_set_by: { guest_id: number; firstname: string; lastname: string } | null;
};

/** Everything the app needs to know about the currently logged-in guest. */
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

/**
 * Full backend-driven event configuration. Consumed both by `home.tsx`
 * (dates, cover, venue) and `EventThemeContext` (palette, font). Any new
 * field added on the backend must appear here or TypeScript will refuse to
 * read it in a consumer.
 */
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
  // --- Raw palette (backend picks primary/secondary/tertiary per event) ---
  color_primary: string | null;
  color_secondary: string | null;
  color_tertiary: string | null;
  // --- Resolved role colours (see EventThemeContext for the resolution order) ---
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
  // --- Feature toggles the couple flips from the backend admin ---
  drink_game_enabled: boolean;
  drink_game_end_time: string | null;
  photo_game_enabled: boolean;
  // --- Backend-selected heading font (lookup key for constants/fonts.ts) ---
  font_heading: string | null;
};

/**
 * True when the guest has responded with either an accepted-pending or a
 * confirmed acceptance — the two states that unlock the full tab set. Used
 * by `app/index.tsx` for the post-login redirect and by
 * `app/(tabs)/_layout.tsx` for tab visibility.
 */
export function isFullAccess(status: RsvpStatus): boolean {
  return status === 'accepted_pending' || status === 'accepted';
}

/**
 * True when the guest is in any of the decline-related sub-states. These
 * guests land on `/declined` and can only trigger a revocation request or
 * log out — the tabs are hidden.
 */
export function isDeclinedFlow(status: RsvpStatus): boolean {
  return (
    status === 'declined_pending' ||
    status === 'declined' ||
    status === 'revocation_requested'
  );
}

// --- Fetchers -------------------------------------------------------------

/** Load the currently logged-in guest incl. family group + RSVP state. */
export async function fetchGuestMe(): Promise<GuestMe> {
  const res = await api.get<GuestMe>('/api/guest/me');
  return res.data;
}

/** Load the event configuration + full theme + venue metadata. */
export async function fetchEventInfo(): Promise<EventInfo> {
  const res = await api.get<EventInfo>('/api/event/info');
  return res.data;
}

// --- RSVP mutations -------------------------------------------------------

/**
 * Set the current guest's own RSVP. The backend returns the new state so the
 * caller does not have to re-fetch `GuestMe`.
 */
export async function postRsvp(attending: boolean): Promise<RsvpStatus> {
  const res = await api.post<{ rsvp_status: RsvpStatus }>('/api/guest/rsvp', { attending });
  return res.data.rsvp_status;
}

/**
 * Set another family member's RSVP by their guest id. Only usable when the
 * current guest is `type: 'family'` and the target belongs to the same
 * `family_name`; the backend enforces the relationship, this client only
 * sends the id and the answer.
 */
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

// --- Photo game -----------------------------------------------------------

/** High-level state of the photo game as reported by the backend. */
export type PhotoGameStatus = 'draft' | 'active' | 'ended';

/**
 * The single task assigned to the current guest, plus its submission state.
 * `submitted_at` and `photo_url` are both `null` until the guest uploads.
 */
export type PhotoGameAssignment = {
  id: number;
  task: { id: number; description: string };
  submitted_at: string | null;
  photo_url: string | null;
};

/** Combined status + assignment lookup returned by `GET /api/game/photo/status`. */
export type PhotoGameStatusResponse = {
  status: PhotoGameStatus;
  assignment: PhotoGameAssignment | null;
};

/** Load the current photo-game status + this guest's assignment (if any). */
export async function fetchPhotoGameStatus(): Promise<PhotoGameStatusResponse> {
  const res = await api.get<PhotoGameStatusResponse>('/api/game/photo/status');
  return res.data;
}

/**
 * Ask the backend to pick a random unassigned task for this guest. Called
 * exactly once per game round; a second call while an assignment already
 * exists returns the same one.
 */
export async function assignPhotoGameTask(): Promise<{ id: number; task: { id: number; description: string } }> {
  const res = await api.post('/api/game/photo/assign');
  return res.data;
}

/**
 * Upload the photo response for the current assignment. `photoUri` must be a
 * local file:// path (Expo image-picker output); axios' `transformRequest` is
 * overridden to `data => data` so React Native's fetch layer sends the
 * FormData as-is without JSON serialisation.
 */
export async function submitPhotoGamePhoto(photoUri: string): Promise<{ photo_url: string; submitted_at: string }> {
  const formData = new FormData();
  formData.append('photo', { uri: photoUri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  const res = await api.post('/api/game/photo/submit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (data) => data,
  });
  return res.data;
}

// --- Revocation -----------------------------------------------------------

/**
 * Request that the couple reverse a decline. Moves the guest from
 * `declined` into `revocation_requested`; the couple's admin UI then flips
 * to `accepted_pending` or leaves it as `declined`.
 */
export async function postRevoke(): Promise<RsvpStatus> {
  const res = await api.post<{ rsvp_status: RsvpStatus }>('/api/guest/rsvp/revoke');
  return res.data.rsvp_status;
}
