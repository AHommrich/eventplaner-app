# On-device storage keys

Every value persisted with `expo-secure-store` is listed here. The list is the
canonical reference for two DSGVO exercises:

- **Art. 13 (transparency)** — the privacy notice's "what we store on your
  device" section is generated from this table.
- **Art. 17 (right to erasure)** — logout must clear every guest-linked entry;
  the table's _cleared on logout?_ column is the checklist.

`expo-secure-store` wraps the platform Keychain (iOS) / Keystore (Android). The
values are encrypted at rest with a key the OS binds to the app install; a
reinstall or "clear app data" purges everything even if this file drifts.

No key ever holds a payload larger than a few hundred bytes. There is no
`AsyncStorage`, no `localStorage`, no on-disk cache outside the OS-managed
image cache of `expo-image`.

## Guest session (set by `lib/auth.ts` `saveSession`)

| Key                 | Purpose                                                                         | Retention                                                                                                                                           | Cleared on logout?  |
| ------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `guest_token`       | Sanctum bearer token — attached by the Axios interceptor to every backend call. | Until logout or backend-side event cleanup/revocation. Tokens are intentionally long-lived for guest UX, but bounded by the event retention window. | Yes                 |
| `guest_id`          | Numeric guest ID — used by the group-RSVP flow to identify the acting guest.    | Until logout.                                                                                                                                       | Yes                 |
| `guest_firstname`   | Rendered on the home screen and RSVP surfaces.                                  | Until logout.                                                                                                                                       | Yes                 |
| `guest_lastname`    | Rendered where the full name is shown (settings, revoke dialog).                | Until logout.                                                                                                                                       | Yes                 |
| `guest_type`        | Either `solo` or `family` — drives whether the RSVP tab lists group members.    | Until logout.                                                                                                                                       | Yes                 |
| `guest_family_name` | Family label for `family`-type sessions; absent for `solo`.                     | Until logout.                                                                                                                                       | Yes (only when set) |

Logout runs both from `lib/auth.ts` `clearSession` and — as a belt-and-braces
duplicate — directly in `app/(tabs)/settings.tsx` so a failed API logout still
wipes the local session.

## Organizer session (set by `lib/management.ts`)

Organizer and guest sessions are mutually exclusive: saving either session deletes every key of
the other actor type first. This prevents the central API client from ever selecting an ambiguous
bearer token.

| Key                                | Purpose                                                                                      | Retention                                                   | Cleared on logout?                |
| ---------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------- |
| `management_token`                 | User Sanctum bearer for `/api/management/*`.                                                 | Up to 90 days; shorter on logout or server-side revoke.     | Yes                               |
| `management_user_id`               | Organizer account ID for the local identity display.                                         | Until logout.                                               | Yes                               |
| `management_user_name`             | Organizer display name.                                                                      | Until logout.                                               | Yes                               |
| `management_user_email`            | Organizer email address.                                                                     | Until logout.                                               | Yes                               |
| `management_active_event_id`       | Event selected by the organizer; sent as `X-Event-ID` on scoped requests.                    | Until logout or switching events.                           | Yes                               |
| `management_pending_logout_tokens` | Dedupe-list of non-interactive bearers retained only to retry failed offline server logouts. | Until each retry succeeds or the server reports it invalid. | No (entries are deleted by retry) |

`management_expo_push_token` is installation state, not organizer-session state, and therefore
lives with the persistent preferences below. It cannot authorize an API request.

## Preferences (persistent across sessions)

| Key                          | Purpose                                                                                   | Retention                   | Cleared on logout?                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------- |
| `app_language`               | Chosen UI locale (`de` or `en`). Restored on next app start by `lib/LanguageContext.tsx`. | Until the guest changes it. | **No** — a returning guest keeps their language preference across logins. |
| `management_expo_push_token` | Last Expo installation token; reused for opt-in sync and token rotation.                  | Until app-data deletion.    | **No** — server delivery still requires a live bound organizer PAT.       |
| `management_push_enabled`    | Explicit organizer push opt-in (`true`/`false`).                                          | Until changed in the app.   | **No** — this is an installation preference.                              |

`app_language` is intentionally kept on logout so an English-speaking guest
does not have to re-pick the language after re-scanning their QR code.

## Explicit consents (set by `lib/consents.ts`)

Keys use the prefix `consent_` followed by the `ConsentKey` value. Each
payload is a single ISO timestamp — the Art. 7 (1) burden-of-proof artefact.

| Key                    | Purpose                                                                                      | Retention                                                                       | Cleared on logout?                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `consent_photo_upload` | Records that the guest agreed to have their uploaded photos shared in the wedding gallery.   | Until the guest revokes via _Settings → Einwilligungen verwalten_ (Art. 7 (3)). | **No** — consent survives logout by design so the next login does not re-prompt. |
| `consent_photo_game`   | Records agreement to participate in the photo game (challenge photos are shared with hosts). | Until revocation.                                                               | **No** — same rationale as above.                                                |
| `consent_camera_scan`  | Records agreement to use the camera for QR login. No image is stored.                        | Until revocation.                                                               | **No** — same rationale as above.                                                |

Revocation deletes the key entirely rather than writing a `revoked_at` entry:
keeping a per-guest consent timeline on-device would itself become a personal-
data trail.

## Erasure request state (set by `lib/erasure.ts`)

The guest can request account deletion (Art. 17) with a 30-day soft-delete
window. During that window the app stays "signed out" but keeps enough state
locally to offer a one-tap revocation without another QR scan.

| Key                        | Purpose                                                                                   | Retention                                                                               | Cleared on logout?                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `erasure_recovery_token`   | One-time backend token that identifies the pending erasure — used to POST the revocation. | Until the erasure is either revoked (client wipes) or finalised (30-day window closes). | **No** — session logout must not lock the guest out of revoking a still-pending erasure. |
| `erasure_scheduled_at`     | ISO timestamp of when the erasure was requested.                                          | Same window.                                                                            | No                                                                                       |
| `erasure_can_revoke_until` | ISO timestamp of the last moment the revocation endpoint accepts the token.               | Same window.                                                                            | No                                                                                       |

All three are wiped together by `revokeErasure`. If the window closes without
a revocation, the entries become stale on-device but harmless — the recovery
token is server-rejected and the erasure-pending screen falls back to the
"window has closed" branch.

## Legal notice caches (set by `lib/legal.ts`)

Keys use the prefix `legal_privacy_cache_` or `legal_imprint_cache_` followed
by the locale.

| Key                      | Purpose                                                                                                                         | Retention                                                                                           | Cleared on logout?                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `legal_privacy_cache_de` | Last-known German privacy notice (JSON: `{ fetched_at, notice }`). Served immediately on open; a background fetch refreshes it. | 24 h fresh window; kept indefinitely as stale-fallback so airplane-mode never shows a blank notice. | **No** — a stale copy is strictly better than no copy for a legal notice. |
| `legal_privacy_cache_en` | Same, English notice.                                                                                                           | Same.                                                                                               | No                                                                        |
| `legal_imprint_cache_de` | Last-known German imprint (JSON: `{ fetched_at, notice }`).                                                                     | Same.                                                                                               | No                                                                        |
| `legal_imprint_cache_en` | Same, English imprint.                                                                                                          | Same.                                                                                               | No                                                                        |

The cache is content addressable per locale so switching language does not
serve the wrong-language notice.

## What is NOT stored

- No photos, drink logs, RSVPs or any other personal payloads — all fetched
  on demand from the backend.
- No analytics, session IDs, device IDs, install IDs.
- No `AsyncStorage` at all (deliberate: only the Keychain-backed
  `expo-secure-store` holds guest data).
- No files outside `expo-secure-store` and the OS-managed `expo-image` cache.

## When this file must be updated

- Any new `SecureStore.setItemAsync` call — add its key here first.
- Any change to what a key holds or how long it lives.
- Any change to what logout clears.

The PR template (Phase 10) includes a DSGVO checklist that gates on this file
being touched whenever `SecureStore` is touched.
