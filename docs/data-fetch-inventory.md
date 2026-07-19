# Data-Fetch Inventory (Checkpoint 0)

Baseline for `docs/APP_PERFORMANCE_DATA_LAYER_PLAN.md` Checkpoint 0. **Static inventory: complete.**
**Live measurements: pending a dev-client run** (see §5 — cannot be captured without a device).

Created: 2026-07-18. No runtime change; this is analysis only.

Method: `grep -rnE "api\.(get|post|patch|delete|put)" app lib` (47 call sites) + the exported
`lib/*.ts` fetch helpers + trigger scan
(`useEffect`/`useFocusEffect`/`setInterval`). SecureStore surface:
`grep -rE "SecureStore\.(get|set|delete)ItemAsync"` = **80 calls across 12 files**.

Legend — **Trigger:** M = mount `useEffect`, F = `useFocusEffect`, P = `setInterval` poll, 1 = one-shot
user action. **Target:** query = cache-backed `useQuery`; mutation = `useMutation` + invalidate; direct
= stays a plain `api` call (auth/one-shot); local = no server fetch.

---

## 1. Guest reads → `useQuery`

| Screen                      | Endpoint / helper                          | Trigger                           | Query-key candidate                                | Notes                                                                           |
| --------------------------- | ------------------------------------------ | --------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------- |
| `app/(tabs)/photos.tsx`     | `GET /api/photos`                          | M + P (30s)                       | `qk.photos(scope)`                                 | **PILOT (CP2).** `fetchPhotos` mutates state → extract pure `fetchGuestPhotos`. |
| `app/(tabs)/home.tsx`       | `fetchEventInfo` + `loadTheme`             | F                                 | `qk.eventInfo(scope)`                              | **Migrated in CP3** (shared theme source); not repeated in CP4.                 |
| `app/(tabs)/drinks.tsx`     | `GET /api/drinks`, `GET /api/drinks/stats` | M + P (stats 5s, block-check 10s) | `qk.drinksCatalog(scope)`, `qk.drinksStats(scope)` | Two polls; see duplicate note re `/api/drinks`.                                 |
| `app/(tabs)/rsvp.tsx`       | `fetchGuestMe`                             | F                                 | `qk.guestMe(scope)`                                | CP4.                                                                            |
| `app/(tabs)/photo-game.tsx` | `fetchPhotoGameStatus`                     | F                                 | `qk.photoGameStatus(scope)`                        | CP4.                                                                            |
| `app/hidden-guests.tsx`     | `fetchHiddenGuests`                        | M                                 | `qk.hiddenGuests(scope)`                           | CP4 (low traffic).                                                              |

## 2. Guest edge / polling paths → `useQuery` (special)

| Screen / module                  | Endpoint / helper                 | Trigger                   | Query-key candidate                        | Notes                                            |
| -------------------------------- | --------------------------------- | ------------------------- | ------------------------------------------ | ------------------------------------------------ |
| `app/blocked.tsx`                | `GET /api/guest/me`               | P (10s)                   | `qk.guestMe(scope)` (re-enable probe)      | CP4. Poll until app un-blocked.                  |
| `app/declined.tsx`               | `fetchGuestMe` + `fetchEventInfo` | M + P (30s)               | `qk.guestMe(scope)`, `qk.eventInfo(scope)` | CP4. Shares keys with home/rsvp — dedup benefit. |
| `lib/BlockedFeaturesContext.tsx` | `GET /api/drinks`                 | M + P (10s while blocked) | `qk.drinksCatalog(scope)`                  | CP4. Duplicate of drinks-tab probe — see §4.     |

## 3. Guest writes → `useMutation` (+ invalidate)

| Origin                    | Endpoint                                      | Invalidates                                  |
| ------------------------- | --------------------------------------------- | -------------------------------------------- |
| `photos.tsx`              | `POST /api/photos`, `DELETE /api/photos/{id}` | `qk.photos(scope)`                           |
| `drinks.tsx`              | `POST /api/drinks/log`                        | `qk.drinksStats(scope)`                      |
| `guest.ts` (rsvp screens) | `postRsvp`, `postGroupRsvp`, `postRevoke`     | `qk.guestMe(scope)`                          |
| `guest.ts` (moderation)   | `reportPhoto`, hide/unhide content            | `qk.hiddenGuests(scope)`, `qk.photos(scope)` |
| `guest.ts` (photo-game)   | `assign`, `submit`                            | `qk.photoGameStatus(scope)`                  |

## 4. Organizer reads/writes

| Screen / module              | Endpoint / helper                             | Trigger            | Target                                               |
| ---------------------------- | --------------------------------------------- | ------------------ | ---------------------------------------------------- |
| `app/organizer/index.tsx`    | `fetchManagementEvents` (+ push sync)         | F                  | query `qk.managementEvents(scope)` (CP3)             |
| `app/organizer/notes.tsx`    | `fetchManagementNotes` + create/patch/delete  | F                  | query `qk.notes(scope)` + mutations (CP5)            |
| `app/organizer/photos.tsx`   | `fetchManagementPhotos` + upload/delete/batch | F                  | query `qk.managementPhotos(scope)` + mutations (CP5) |
| `app/organizer/schedule.tsx` | `fetchManagementSchedule`                     | F + local 1s timer | query `qk.managementSchedule(scope)` (CP5)           |

## 5. No server fetch (do NOT schedule for query migration)

| Screen                       | What it actually does                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `app/(tabs)/schedule.tsx`    | Reads `eventInfo` from theme context + a 1 Hz countdown timer. Handled by CP3 theme consolidation. |
| `app/organizer/settings.tsx` | Session + logout only; its `loadTheme()` is consolidated in CP3. Nothing left for CP5.             |

## 6. Auth / one-shot → stays direct `api` (prime cache after)

`app/index.tsx`, `app/scan.tsx` (`GET /api/auth/qr/{token}`, `POST .../select`, `fetchManagementEvents`);
`lib/management.ts` (`POST /api/auth/pair`, `DELETE /api/auth/logout`). On successful login, prime via
`queryClient.fetchQuery(...)` per CP4's login note. Legal/export/erasure endpoints (`lib/legal.ts`,
`lib/guest.ts` export/erasure) are rare one-shots — optional low-priority queries with a long
`staleTime`, not in the core checkpoints.

## 7. Duplicate fetches (the consolidation targets)

- **`fetchManagementEvents`** — called from `organizer/index.tsx` (focus), `EventThemeContext.loadTheme`,
  and `index.tsx`/`scan.tsx` (login). → collapse to one shared query in **CP3**.
- **Event info** — `home.tsx` (`fetchEventInfo`), `EventThemeContext.loadTheme`, and `declined.tsx` all
  hit event info. → shared `qk.eventInfo(scope)` in **CP3**.
- **`GET /api/drinks`** — `drinks.tsx` and `BlockedFeaturesContext` both probe it. → share
  `qk.drinksCatalog(scope)` in **CP4**.

## 8. SecureStore hot-path (Checkpoint 1 target)

80 SecureStore calls across 12 files. Hot-path (per request / per render) vs lifecycle:

| File                             | Calls | Hot path?                                                                                       |
| -------------------------------- | ----- | ----------------------------------------------------------------------------------------------- |
| `lib/api.ts`                     | 6     | **YES — per request** (interceptor). CP1's write-through cache removes these from the hot path. |
| `lib/EventThemeContext.tsx`      | 2     | Per `loadTheme` (many focus paths). Removed by CP3.                                             |
| `lib/BlockedFeaturesContext.tsx` | 2     | Per poll tick.                                                                                  |
| `lib/management.ts`              | 17    | Mostly login/logout/session lifecycle; token reads centralize in CP1.                           |
| `lib/managementPush.ts`          | 15    | Push lifecycle (already trimmed by emergency Fix B/C).                                          |
| `lib/auth.ts`                    | 12    | Guest session lifecycle.                                                                        |
| `app/(tabs)/settings.tsx`        | 7     | Screen mount.                                                                                   |
| `lib/erasure.ts`                 | 9     | Erasure flow (rare).                                                                            |
| `lib/consents.ts` / `legal.ts`   | 3 ea  | Consent/legal (rare).                                                                           |
| `lib/LanguageContext.tsx`        | 2     | Language read/write.                                                                            |
| `lib/sessionStorage.ts`          | 2     | Session delete helpers.                                                                         |

## 9. Live measurements — ⚠️ PENDING (requires a dev-client run)

Cannot be captured from static analysis. Run `npx expo start --dev-client` on a physical device with a
temporary request-count/size/duration log in the interceptor, exercise each flow, then fill this table
and **remove the temporary log** before handing back CP0.

| Flow                             | Requests | Duplicate requests | Total payload | Wall-clock | Notes |
| -------------------------------- | -------- | ------------------ | ------------- | ---------- | ----- |
| Cold start → home                | _TBD_    | _TBD_              | _TBD_         | _TBD_      |       |
| Guest photos tab focus loop (×5) | _TBD_    | _TBD_              | _TBD_         | _TBD_      |       |
| Organizer home focus loop (×5)   | _TBD_    | _TBD_              | _TBD_         | _TBD_      |       |
| RSVP submit                      | _TBD_    | _TBD_              | _TBD_         | _TBD_      |       |

**Static expectation (to confirm/refute against the measured numbers):** the "~90% client-side"
hypothesis predicts the wins come from (a) removing per-request keychain reads (§8), (b) collapsing the
duplicate event/management-events fetches (§7), and (c) stopping focus-triggered refetch storms. If the
measured `/api/photos` payload grows large with gallery size, escalate Follow-up FU2 (backend
pagination/ETag) — a client cache does not shrink a full download.
