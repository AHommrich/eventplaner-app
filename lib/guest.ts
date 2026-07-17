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
import { DesignVariantKey } from '../constants/theme';

// --- RSVP + guest identity types ---

export type RsvpStatus =
  null | 'accepted_pending' | 'accepted' | 'declined_pending' | 'declined' | 'revocation_requested';

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
/**
 * One stop on the event timeline (registry office, lunch, party, …). Times are
 * "HH:MM" local wall-clock; the absolute moment is composed with `EventInfo.date`.
 * `ends_at` is null for open-ended stations. `address` is a display string;
 * `lat`/`lng` drive map navigation when present.
 */
export type ScheduleStation = {
  id: number;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  location_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

export type EventInfo = {
  name: string;
  // Both null when the couple has not set a date/deadline yet — the API sends
  // `null` (not "") for empty values, so every consumer must be null-safe.
  date: string | null;
  rsvp_deadline: string | null;
  cover_image_url: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  venue_display_mode: 'address' | 'name' | 'both';
  dresscode: string | null;
  schedule: string | null;
  // --- Structured schedule stations, already filtered to what this guest may
  // see (backend applies per-group visibility). Ordered by the couple. ---
  schedule_stations: ScheduleStation[];
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
  color_nav_bg: string | null;
  color_home_text: string | null;
  color_home_shadow: string;
  home_shadow_opacity: number;
  // --- Feature toggles the couple flips from the backend admin ---
  drink_game_enabled: boolean;
  drink_game_end_time: string | null;
  photo_game_enabled: boolean;
  // --- Backend-selected heading font (lookup key for constants/fonts.ts) ---
  font_heading: string | null;
  // --- Backend-selected design preset (form language; see DESIGN_VARIANTS).
  // Optional/nullable: legacy events and older backends omit it → the client
  // falls back to DEFAULT_DESIGN_VARIANT. ---
  design_preset?: DesignVariantKey | null;
};

/** Exact theme fields shared by the Guest and bound Organizer APIs. */
export type EventThemePayload = Pick<
  EventInfo,
  | 'color_primary'
  | 'color_secondary'
  | 'color_tertiary'
  | 'color_screen_bg'
  | 'color_card'
  | 'color_card_text'
  | 'color_card_button'
  | 'color_card_button_text'
  | 'color_tab_tint'
  | 'color_border'
  | 'color_fab'
  | 'color_fab_icon'
  | 'color_nav_bg'
  | 'color_home_text'
  | 'color_home_shadow'
  | 'home_shadow_opacity'
  | 'font_heading'
  | 'design_preset'
>;

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
    status === 'declined_pending' || status === 'declined' || status === 'revocation_requested'
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
  attending: boolean
): Promise<{ guest_id: number; rsvp_status: RsvpStatus }> {
  const res = await api.post<{ guest_id: number; rsvp_status: RsvpStatus }>(
    `/api/guest/${guestId}/rsvp`,
    { attending }
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
export async function assignPhotoGameTask(): Promise<{
  id: number;
  task: { id: number; description: string };
}> {
  const res = await api.post('/api/game/photo/assign');
  return res.data;
}

/**
 * Upload the photo response for the current assignment. `photoUri` must be a
 * local file:// path (Expo image-picker output); axios' `transformRequest` is
 * overridden to `data => data` so React Native's fetch layer sends the
 * FormData as-is without JSON serialisation.
 */
export async function submitPhotoGamePhoto(
  photoUri: string,
  onUploadProgress?: (fraction: number | null) => void
): Promise<{ photo_url: string; submitted_at: string }> {
  const formData = new FormData();
  formData.append('photo', { uri: photoUri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  const res = await api.post('/api/game/photo/submit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (data) => data,
    onUploadProgress: onUploadProgress
      ? (e) => onUploadProgress(e.total ? e.loaded / e.total : null)
      : undefined,
  });
  return res.data;
}

// --- UGC moderation -------------------------------------------------------

export type PhotoReportReason = 'inappropriate_content' | 'privacy' | 'other';

export type PhotoReportResponse = {
  id: number;
  status: 'pending';
  auto_hidden: boolean;
};

export type HiddenGuest = {
  id: number;
  firstname: string;
  lastname: string;
};

/** Report a visible photo to the event owner/staff. Reporter identity stays backend-only. */
export async function reportPhoto(
  photoId: number,
  payload: { reason: PhotoReportReason; message?: string }
): Promise<PhotoReportResponse> {
  const res = await api.post<PhotoReportResponse>(`/api/photos/${photoId}/report`, payload);
  return res.data;
}

/** Hide all current/future photo content from one uploader for the current guest. */
export async function hideGuestContent(guestId: number): Promise<{ hidden_guest_id: number }> {
  const res = await api.post<{ hidden_guest_id: number }>(`/api/guests/${guestId}/hide-content`);
  return res.data;
}

/** Undo a previous content-hide. Backend treats this as idempotent. */
export async function unhideGuestContent(guestId: number): Promise<void> {
  await api.delete(`/api/guests/${guestId}/hide-content`);
}

/** Load guests whose photo content the current guest has hidden. */
export async function fetchHiddenGuests(): Promise<HiddenGuest[]> {
  const res = await api.get<{ hidden_guests: HiddenGuest[] }>('/api/guests/hidden-content');
  return res.data.hidden_guests;
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

// --- Art. 15 / Art. 17 GDPR (data subject rights) -------------------------
//
// The three endpoints below implement guest-facing Data Subject Rights:
//
//   - `exportMyData()` .......... Art. 15 "right of access": returns a
//                                  scoped JSON payload of everything the
//                                  guest has produced (RSVP, photos, drinks,
//                                  photo-game submission). Guest-scoped by
//                                  the backend — never any other guest's
//                                  data, family members appear as
//                                  minimal-info stubs only.
//   - `requestErasure()` ........ Art. 17 "right to erasure": schedules a
//                                  soft delete with a 30-day grace window.
//                                  The backend revokes the sanctum token
//                                  immediately, so the caller MUST clear
//                                  the session locally right after.
//                                  Backend returns a one-time `recovery_token`
//                                  (plain text, sha256-hashed at rest — the
//                                  only way to revoke since the guest has
//                                  no email address).
//   - `revokeErasure()` ......... Cancel the scheduled deletion within the
//                                  grace window. Uses the recovery token
//                                  (NOT the sanctum bearer, which has been
//                                  revoked at request time).
//
// The recovery-token lifecycle is documented in `lib/erasure.ts`.

/**
 * Data payload returned by `GET /api/guest/export`. `format_version` allows
 * the backend to evolve the schema without breaking existing clients — bump
 * on breaking changes, add a version check at the call site.
 */
export type GuestExport = {
  format_version: number;
  generated_at: string;
  guest: {
    id: number;
    firstname: string;
    lastname: string;
    family_name: string | null;
    language: string | null;
    rsvp_status: RsvpStatus;
    rsvp_set_at: string | null;
    created_at: string;
  };
  family_members: {
    id: number;
    firstname: string;
    lastname: string;
    rsvp_status: RsvpStatus;
  }[];
  photos: { id: number; url: string; uploaded_at: string }[];
  drink_logs: { id: number; drink_name: string; points: number; logged_at: string }[];
  photo_game_submission: {
    assignment: string;
    photo_url: string | null;
    submitted_at: string | null;
  } | null;
};

/**
 * Response of `POST /api/guest/erasure`. `recovery_token` is the ONLY way to
 * revoke the request — persist it before doing anything else. `recovery_delivery`
 * is either `"response_only"` (guest has no email) or `"email"` (backend will
 * send a mail) — the client shows different UX per branch.
 */
export type ErasureResponse = {
  scheduled_erasure_at: string;
  can_revoke_until: string;
  recovery_token: string;
  recovery_delivery: 'response_only' | 'email';
  recovery_note: string;
};

/** Load an Art. 15 export of the currently logged-in guest. */
export async function exportMyData(): Promise<GuestExport> {
  const res = await api.get<GuestExport>('/api/guest/export');
  return res.data;
}

/**
 * Schedule the guest for deletion with a 30-day grace window. On success the
 * caller MUST persist the recovery token (see `lib/erasure.ts`) and clear
 * the session — the backend has already revoked the bearer token.
 */
export async function requestErasure(): Promise<ErasureResponse> {
  const res = await api.post<ErasureResponse>('/api/guest/erasure');
  return res.data;
}

/**
 * Cancel a pending erasure within the grace window. Authenticated by the
 * plain-text `recovery_token` in the body — the sanctum bearer that
 * `requestErasure()` returned with was revoked at request time and cannot
 * be used here.
 */
export async function revokeErasure(recoveryToken: string): Promise<{ success: boolean }> {
  const res = await api.post<{ success: boolean }>('/api/guest/erasure/revoke', {
    recovery_token: recoveryToken,
  });
  return res.data;
}
