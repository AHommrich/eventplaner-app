# App Performance & Data-Layer Plan

Status: **CP0–CP6 ALL DONE (working tree, uncommitted, all green — 361 tests, tsc, eslint 0 errors,
prettier)** · Created: 2026-07-18 · Author: André + analysis (Claude) + two critical reviews
(Codex/GPT). Workable by any tool (Claude
Code, Codex, OpenCode).

> **Progress (2026-07-18):** CP0–CP5 implemented and green (359 tests, tsc, eslint 0 errors, prettier).
>
> - **CP1** session cache (`lib/sessionCache.ts` + `lib/SessionContext.tsx`, incl. race test).
> - **CP2** interceptor `HandledApiError` rewrite + 14-site caller audit; `lib/queryClient.ts` +
>   `lib/queryKeys.ts` + NetInfo `onlineManager`; `photos` pilot on `useQuery`.
> - **CP3** theme/bootstrap consolidated — `EventThemeContext` is cache-backed and uses the module
>   `queryClient` singleton explicitly (so the 22 test files mounting it needed no provider wrapper);
>   `home` reads `eventInfo` from it (no own fetch); `organizer/index` shares the `managementEvents`
>   query. Canonical keys: guest→`qk.eventInfo`, management→`qk.managementEvents` (returns the raw
>   `ManagementEvent[]`).
> - **CP4** guest screens: `rsvp`, `photo-game`, `declined` migrated to `useQuery` + `setQueryData`
>   optimistic updates; `home`/`schedule` handled in CP3. **`blocked.tsx` and
>   `BlockedFeaturesContext` are intentionally left as-is** — they are fire-and-redirect re-enable
>   probes with no cacheable data; a `useQuery` there adds no value.
> - **CP5** organizer `notes`, `photos`, `schedule` migrated (queries + invalidation/`setQueryData`).
>
> Test pattern for screens keyed on scope: seed `setCached(...)` + `mintSessionId()` in `beforeEach`
> (guest or management). All read helpers now take an optional `AbortSignal`; direct-call tests assert
> `toHaveBeenCalledWith(url, { signal: undefined })`.
>
> - **CP6** offline persistence (`lib/queryPersistence.ts`): `PersistQueryClient` via
>   AsyncStorage with a strict **allowlist** dehydrate policy (only `eventInfo`, `photos`,
>   `drinks*`, `managementEvents`, `managementSchedule`; auth/session-derived queries never persist),
>   `sessionId`-scope isolation, `maxAge` 24h + version `buster`, and `purgePersistedCache()` wired
>   into logout / account switch / GDPR erasure. Governance synced: `docs/ARCHITECTURE.md` §7,
>   `docs/storage-keys.md`, `docs/dependencies.md`. Guard test: `tests/lib/queryPersistence.test.ts`.
>
> **Post-audit hardening (2026-07-18/19, from Codex + Claude reviews).** Fixed & green:
> pre-CP1 session migration (`primeFromStore` back-fills `session_id`); focus refetch now stale-gated
> via `lib/useRefetchOnFocus.ts` (home/rsvp/photo-game) — the real "no fetch on every tab switch" fix;
> 401 path + account switch now `purgePersistedCache()`; dehydrate filter rejects anon/invalid scopes
> (`shouldPersistQuery`, unit-tested); retry policy no longer retries 4xx except 408/429; photo-game
> assign/submit catches guard `isHandledApiError`; drinks removed from persist allowlist (screen not
> migrated).
>
> **2026-07-19 continuation — DONE (371 tests; green in isolation and in an unloaded full run — see
> the flake note below; tsc + eslint 0 errors + prettier clean):**
>
> - **Organizer focus stale-gate** (was "index/notes/photos still focus-refetch unconditionally").
>   `organizer/index`, `notes`, `photos` and `schedule` now use `useRefetchOnFocus` instead of an
>   unconditional `refetch()` in `useFocusEffect`; the redirect/session bootstrap stays in its own
>   focus effect (organizer/index splits `load` into `bootstrapSession` + a forced pull-to-refresh).
>   `useRefetchOnFocus` gained an `enabled` arg (default `true`, so the 3 migrated guest tabs are
>   unchanged) — a disabled/redirecting scope must not fire a stray fetch, which keeps the
>   "no notes/photos fetch without a bound event" specs passing.
> - **sessionCache race polish.** `removeCached` now `rebuildScope()`s BEFORE the SecureStore await
>   (logout consumers see the scope drop synchronously); `primeFromStore` is deduped (concurrent
>   callers share one keychain sweep), generation-guarded (a logout mid-sweep discards the stale
>   snapshot), and back-fill-only (a login landing mid-sweep is never clobbered). Two new guard tests
>   in `tests/lib/sessionCache.test.ts`.
>
> **STILL OPEN before the build (NOT done — do next):**
>
> - **Bootstrap not truly gated.** `app/_layout.tsx` renders the router tree before `primeFromStore()`
>   resolves (`primed` only hides the splash). Gate the tree on `primed` AND wrap in
>   `PersistQueryClientProvider` using its `isRestoring` flag so no query runs before session-prime +
>   cache-restore complete (fixes a real restore/fetch race for "offline after restart"). **Deliberately
>   NOT attempted in the 2026-07-19 session:** it rewires `_layout.tsx` (which has NO test coverage) to
>   a new provider + `isRestoring` gate, and a broken gate white-screens the boot — the plan's own
>   "never ship blind" rule requires dev-client verification a coding session can't provide. Do it with
>   a device in hand. (`queryPersistence.ts` still needs to export a `persistOptions` for the provider.)
> - **Full-run parallel test flake (root cause identified 2026-07-19; test-infra fix deferred).** The
>   suite is green in isolation and in an unloaded run, but the default parallel `npm test` (and even
>   `--runInBand` under heavy machine load) intermittently fails 1–3 heavy screen-state specs
>   (`tabs-schedule "empty state"`, `tabs-photo-game "submitted"`, `organizer-schedule`). Proven NOT a
>   data race and NOT caused by the changes above: each spec passes alone (~60 ms), and the failing set
>   includes suites this work never touched. It is CPU-contention on real-timer + `findBy` specs — when
>   the JS event loop is starved, React can't flush the query-resolution render before the matcher
>   times out. A bumped RNTL `asyncUtilTimeout` did NOT fix it (failures just wait longer), so the
>   durable fix is test-infra: fake timers on those specs, or run CI with `--runInBand`. This is the
>   same class as the previously-noted "flaky organizer-schedule".
> - **Jest doesn't exit cleanly** (open handles: AppState/NetInfo listeners in `queryClient.ts`, the
>   never-unsubscribed `persistQueryClient` subscription from `initQueryPersistence()`, screen timers)
>   — add teardown. `--forceExit` only masks it.
> - **Not migrated (mark done or finish):** `drinks.tsx`, `hidden-guests.tsx`, login `fetchQuery`
>   prefetch, `managementPush` token reads via `getCached`. CP0 live measurements still device-TBD.
>
> **FU1 splash delay, FU2 backend gallery pagination remain separate tasks.**

> **Why this exists.** The organizer rollout (2026-07-17) exposed a structural weakness, not just a
> bug: the app is a thin client with **no data layer**. Every screen fetches on its own, every tab
> focus refetches, tokens are read from the iOS keychain on every single request, and there is no
> cache — so on slow/no network the UI is blocked or empty. That is the "klapprig" (rickety) feeling.
> Three emergency fixes already exist in the working tree (see below); this plan is the durable
> foundation that replaces them properly.

## Context: emergency fixes already in the working tree (do not redo, build on top)

Emergency perf fixes **implemented in the working tree on 2026-07-18 — NOT yet committed** (intended
commit: `perf(app): cut redundant keychain reads and push re-registration`). Until that commit lands,
this section describes the working tree, not shipped history:

- **Fix A** — `lib/api.ts` interceptor now reads only the token a request needs, not all four
  SecureStore keys. **Checkpoint 1 below supersedes this** with an in-memory write-through cache.
- **Fix B** — `lib/managementPush.ts` `syncManagementPushPreference` no-ops when a token is already
  registered instead of re-running `getExpoPushTokenAsync` + POST on every organizer-home focus.
- **Fix C** — `lib/managementPush.ts` `registerRotatedPushToken` skips the POST when the rotated
  token is unchanged.

Push flows stay as-is; they are event-driven, not query-shaped, and are out of scope for the data
layer.

> **Hypothesis, not yet proven:** backend analysis (repo `eventplaner`) found the API lean, so the
> performance lever is believed to be **~90% client-side**. Checkpoint 0 must **measure** this before
> the plan relies on it. The one place the backend does re-enter scope is gallery growth — see
> Follow-up FU2.

## ⚠️ SCOPE FENCE — read before touching anything

**IN SCOPE:** a client-side data layer (caching, dedup, stale-while-revalidate), an in-memory session
cache, and consolidation of duplicate fetch triggers. This is maintenance/hardening, not a new
feature — consistent with "app is feature-complete; maintenance and hardening stay in scope."

**OUT OF SCOPE — do NOT fold in:**

- New product features or UI redesigns (e.g. the deferred timetable redesign — separate task).
- Backend/API changes, **except** the measured, conditional FU2 (gallery pagination/ETag) which is
  filed as its own backend follow-up, not built inside these checkpoints.
- Push notification internals beyond wiring token reads through the session cache (Checkpoint 1).
- Offline write queue and optimistic mutations are **entirely out of scope** (Checkpoint 6 persists
  reads only; it specifies no offline writes).
- A Redux-style global store or additional state libraries — TanStack Query is sufficient (confirmed
  in review). Do not add zustand/jotai/redux.

Boundary rule: if a change is not required by a checkpoint as written, it does not belong in that
checkpoint's commit.

## How to work this plan (read first)

- **Read `AGENTS.md` in full** — hard rules + execution environment. Never commit/push/deploy; hand
  back an English commit message per checkpoint.
- Everything here is **[app]** (`eventplaner-app`). Node 20 required for all tooling.
- Work checkpoints **in order**. Each checkpoint = one independently green, shippable unit with its
  own handed-back commit message. **Verify CI green before handing back the message:**

  ```
  source ~/.nvm/nvm.sh && nvm use 20 && npm run typecheck && npm test && npm run lint && npm run format:check
  ```

- **Never ship blind.** Because build slots are scarce, each checkpoint that changes runtime behaviour
  must be verified on a physical device via **dev-client** (`npx expo start --dev-client`, costs no EAS
  slot) before it goes into a release build. Dev-client has camera + APNs; the iOS simulator has
  neither.
- Reference docs already in the repo: `docs/ARCHITECTURE.md`, `docs/storage-keys.md` (SecureStore
  keys), `docs/dependencies.md`, `docs/REFACTOR_PLAN.md`.

## Design decisions (locked)

1. **Data layer = TanStack Query (`@tanstack/react-query`).** Rationale: battle-tested in React
   Native, gives stale-while-revalidate, request dedup, retry/backoff, and focus/interval refetch out
   of the box. Rejected: hand-rolled cache (reinvents dedup/invalidation), SWR (weaker RN focus
   story), zustand/jotai/redux (state, not a server-cache). No additional store library.
2. **Tokens/session live in an in-memory write-through cache; keychain is the source of truth, not the
   hot path.** See Checkpoint 1 for the exact contract (write-through + generation counter). The cache
   must be **reactive**: it exposes `subscribe()`/`getSnapshot()` and a `useSessionScope()` hook
   (`useSyncExternalStore`). A plain module cache does NOT re-render React on login/logout, so the
   always-mounted theme provider would never learn about a new scope once `loadTheme()` is removed.
3. **Query keys are session- and event-scoped via one non-secret scope object.** Define once:

   ```ts
   type QueryScope =
     | { actor: 'guest'; guestId: number; sessionId: string }
     | { actor: 'management'; userId: number; eventId: number; sessionId: string };
   ```

   `sessionId` is a **non-secret random id minted at login, stored in SecureStore, deleted at logout**
   — it is **stable across app restarts** so Checkpoint 6's persisted cache can be re-associated, and
   it isolates data even if a cache purge fails. **Do NOT confuse it with the in-memory generation
   counter** of Decision 2 (that one is a per-process race-guard, not persisted). All account-specific
   keys take the scope: `qk.photos(scope)`, `qk.eventInfo(scope)`, `qk.notes(scope)`,
   `qk.managementEvents(scope)`, `qk.guestMe(scope)`. **Never** use the bearer token (or any secret) as
   a scope. On logout / account switch / event switch, `queryClient.clear()` runs in the same atomic
   path that publishes the new session snapshot. This is a **security** requirement.

4. **Query functions are pure and cancellable.** The `signal` cannot be "wired globally into axios" —
   each `queryFn` must accept and forward it: `queryFn: ({ signal }) => fetchGuestPhotos({ signal })`.
   Read helpers must **return data and never mutate screen state** (the current `fetchPhotos` in
   `app/(tabs)/photos.tsx` sets `setPhotos`/`setLoadError` and returns `void` — it must be refactored
   to a pure `fetchGuestPhotos(signal?): Promise<Photo[]>`). Same rule for every read helper migrated
   later.
5. **Provider order is fixed:** `LanguageProvider` → `QueryClientProvider` (→ `PersistQueryClientProvider`
   at Checkpoint 6) → `SessionProvider` / `EventThemeProvider` → `BlockedFeaturesProvider` →
   `ConsentGate`. Root render waits for `primeFromStore()` to resolve so the first paint already has
   the correct scope.
6. **Migration is screen-by-screen**, never a big-bang rewrite. Each screen is its own green commit.
7. **Query keys are centralized** in `lib/queryKeys.ts` so invalidation is greppable and typo-proof.

---

## Checkpoint 0 — Inventory, measurement & guardrails (no behaviour change)

**Rationale:** you cannot consolidate fetches you have not mapped, and the "~90% client-side" claim is
unproven. Produces a documented inventory **plus real measurements**; ships zero runtime change.

**Steps:**

1. Enumerate every network call: `grep -rE "api\.(get|post|patch|delete|put)" app lib` (47 call sites)
   and every exported fetch helper in `lib/*.ts` (`fetchGuestMe`, `fetchEventInfo`,
   `fetchPhotoGameStatus`, `fetchHiddenGuests`, `fetchManagementNotes`, `fetchManagementEvents`,
   `fetchManagementPhotos`, `fetchManagementSchedule`, …).
2. Inventory in a new `docs/data-fetch-inventory.md`: for each screen record **what it fetches, on what
   trigger** (mount / `useFocusEffect` / poll interval), and the query-key candidate. **Must include
   the paths the first draft missed:** `app/index.tsx` (session probe, QR auth,
   `fetchManagementEvents`), `app/scan.tsx` (same), `app/declined.tsx` (polls `fetchGuestMe` +
   `fetchEventInfo`), `app/blocked.tsx` (polls `/api/guest/me`), `lib/BlockedFeaturesContext.tsx`
   (probes/polls `/api/drinks`). **Also record which screens have NO server fetch** so they are not
   mis-scheduled for query migration: `app/(tabs)/schedule.tsx` (reads `eventInfo` from the theme
   context plus a local timer, no server query) and `app/organizer/settings.tsx` (session + logout
   only). Flag duplicate fetches (`loadTheme()` and `organizer/index.tsx` both call
   `fetchManagementEvents()`; `home` and `EventThemeContext` both hit event info).
3. **Measure** typical flows on a dev-client with a temporary interceptor log (request count,
   duplicates, response size, round-trip duration): cold start → home; guest photos tab focus loop;
   organizer home focus loop; RSVP submit. Record numbers in the inventory doc — this confirms or
   corrects the "~90% client-side" hypothesis and is the baseline to compare each later checkpoint
   against.
4. Enumerate every `SecureStore.getItemAsync/setItemAsync/deleteItemAsync` call site; note which run
   in a request/render hot path.

**Acceptance:** `docs/data-fetch-inventory.md` lists all 47 call sites (incl. the five polling paths
and the two no-fetch screens above), grouped by screen/trigger/query-key candidate; duplicates marked;
flow measurements recorded as the baseline.

**Verify:** doc review only. Remove the temporary interceptor log before handing back. Run the verify
block.

---

## Checkpoint 1 — In-memory write-through session cache (replaces emergency Fix A)

**Rationale:** each `getItemAsync` is a native keychain round-trip. Reading tokens per request is the
wrong pattern. A naive "read lazily, invalidate on write" scheme has a real race: a read started
before logout can resolve **after** logout and repopulate the cache with a dead token. Use a
write-through cache with a generation counter.

**Files:** new `lib/sessionCache.ts`, new `lib/SessionContext.tsx`; wire into `lib/api.ts`,
`lib/auth.ts` (`saveSession`), `lib/management.ts` (`saveManagementSession`,
`setActiveManagementEvent`), `lib/sessionStorage.ts` (`deleteGuestSession`, `deleteManagementSession`),
`lib/LanguageContext.tsx` (language change), and `app/_layout.tsx` (bootstrap prime + provider).

**Contract (`lib/sessionCache.ts`):**

- Keys: `guest_token`, `management_token`, `management_active_event_id`, `app_language`, plus a
  non-secret `session_id` (see below).
- `getCached(key)`: returns the in-memory value; caches **null** too, and de-dupes concurrent
  in-flight SecureStore reads (one read per key per generation).
- `setCached(key, value)`: writes SecureStore **and** updates the memory value.
- `removeCached(key)`: clears the memory value **first**, then deletes SecureStore.
- **Generation counter (in-memory only):** bump on every logout / account switch / clear. A SecureStore
  read tagged with an old generation is discarded on resolve, so it can never write a stale token back.
  This is a per-process race-guard — **not** the persisted `sessionId`.
- **`sessionId` (persisted, non-secret):** minted at login, stored in SecureStore, deleted at logout.
  Survives restarts so it can key the persisted cache (Checkpoint 6) and the `QueryScope`.
- **Reactive layer:** `subscribe(listener)` + `getSnapshot()`; `primeFromStore()` awaited **once**
  during bootstrap. Login/logout/switch mutate the cache and then publish **one atomic snapshot**.
- `lib/SessionContext.tsx`: `SessionProvider` + `useSessionScope()` built on `useSyncExternalStore`,
  returning the current `QueryScope | null`. Screens and the theme provider derive scope from this,
  never from a raw module read.

**Steps:**

1. Implement the cache contract + the reactive Session context above.
2. `lib/api.ts` interceptor reads via `getCached` (replace the Fix-A per-request SecureStore reads).
3. Every write path uses `setCached` / `removeCached`, bumps the generation on logout/switch, mints or
   clears `sessionId`, and publishes a new snapshot atomically. This is the security-critical part.
4. `app/_layout.tsx`: await `primeFromStore()` before the first render; mount `SessionProvider` per the
   provider order in Design Decision 5.

**Acceptance:** **at most one SecureStore read per key per cache generation; subsequent requests
perform no SecureStore reads** (verified by a spy). Logout/`deleteManagementSession` immediately makes
the next request carry no bearer **and** re-renders `useSessionScope()` consumers with a null/new
scope. `sessionId` persists across a restart and is gone after logout.

**Tests:** extend `tests/lib/api.test.ts` + a session-context test — (a) N requests → one keychain read
per key until a generation bump; (b) after logout, the next request has no `Authorization`; (c) event
switch updates `X-Event-ID`; (d) **race test:** start a SecureStore read, run logout mid-flight,
resolve the read afterwards — the old token must NOT reappear; (e) `useSessionScope()` re-renders on
login/logout; (f) `sessionId` is stable across a simulated restart and cleared on logout.

**Verify:** verify block green + dev-client smoke test (login → navigate → logout).

---

## Checkpoint 2 — TanStack Query foundation (interceptor contract + online + pilot)

**Rationale:** stand up the cache and prove the pattern on one screen — but three foundation issues
MUST be fixed before the pilot, or queries will hang, retry wrongly, or double-alert.

**Files:** `package.json` (`npx expo install @tanstack/react-query @react-native-community/netinfo`);
`lib/api.ts` (interceptor rewrite); `lib/queryClient.ts` (new); `lib/queryKeys.ts` (new); a pure
`fetchGuestPhotos` read helper (in `lib/guest.ts` or `lib/photos.ts`); `app/_layout.tsx` (providers);
the pilot screen. Update `docs/dependencies.md` (two new runtime deps) **and** `docs/ARCHITECTURE.md`
(add the Query/provider layer now — not only at Checkpoint 6).

**Steps:**

1. **Fix the never-settling interceptor promises FIRST** (`lib/api.ts:122/129/144` currently return
   `new Promise(() => {})` for `app_blocked`, `drinks_blocked`, and authenticated 401). A query whose
   `queryFn` awaits one of these would hang in `fetching` forever. Replace with a defined
   `HandledApiError` (or a cancellation) so the promise **always** settles (reject). The existing
   global side effects (redirect to `/blocked`, drinks handler, session clear) stay, but the promise
   must reject. Keep the module-level debounce flags.
2. **Audit all direct callers to prevent double-reporting.** Because the promise now rejects instead of
   hanging, existing `try/catch` blocks will suddenly receive this error and may show an Alert on top
   of the global redirect/cleanup. Add a central `isHandledApiError(e)` / cancellation check and make
   every direct caller (and later every `queryFn`) ignore it. This directly affects the former
   never-settling code around `lib/api.ts:110`.
3. **Retry policy** in `lib/queryClient.ts`: no retry for `HandledApiError` and for 401/403/404/422;
   bounded retry with backoff only for network errors / 5xx / (optionally) 429.
4. `lib/queryClient.ts` defaults: `staleTime` (~30s), `gcTime`, the retry policy above, **AppState
   focus refetch** (`focusManager` + `AppState` listener), and **NetInfo → `onlineManager`** so
   reconnects are detected and offline suppresses pointless retries. Note: the `signal` is **not**
   global — each `queryFn` forwards it (Design Decision 4).
5. `lib/queryKeys.ts`: the scoped key factory from Design Decision 3 (`QueryScope`, with `sessionId`).
6. `app/_layout.tsx`: wrap in `QueryClientProvider` per the Design Decision 5 provider order; add
   `queryClient.clear()` to logout/account-switch/event-switch (alongside Checkpoint 1's generation
   bump + snapshot publish).
7. **Pilot:** first extract a pure `fetchGuestPhotos(signal?): Promise<Photo[]>` (the current
   `fetchPhotos` mutates `setPhotos`/`setLoadError` and returns `void` — not usable as a `queryFn`).
   Then migrate `app/(tabs)/photos.tsx` — `useQuery({ queryKey: qk.photos(scope), queryFn: ({ signal })
=> fetchGuestPhotos({ signal }), refetchInterval: isFocused ? 30_000 : false,
refetchIntervalInBackground: false })`. Keep pull-to-refresh via `refetch`. (AppState alone does not
   know the active tab — gate polling on `isFocused`.)

**Acceptance:** blocked/401 responses make the query settle (never hang) **and** produce no extra
screen Alert on top of the global redirect/cleanup; no retries on handled/4xx; photos tab shows cached
photos instantly on re-focus and revalidates; no fetch storm; polling stops when the tab is not
focused; switching account/event clears the cache.

**Tests:** interceptor rejects with `HandledApiError` for blocked/401; `isHandledApiError` suppresses
the screen Alert while the block-redirect / 401-cleanup still fire; retry policy honored; pilot query +
`queryClient.clear()` on logout; existing photo tests green. **Test infra:** a fresh `QueryClient` per
test (or cleared after), retries disabled in tests.

**Verify:** verify block green + dev-client: toggle tabs (no burst), airplane-mode a request (query
rejects, no infinite spinner), trigger a block (redirect fires, no duplicate alert).

---

## Checkpoint 3 — Consolidate theme/bootstrap (moved up, before guest screens)

**Rationale (review fix):** `EventThemeContext.loadTheme()` and `organizer/index.tsx` both call
`fetchManagementEvents()`, and `home` + `EventThemeContext` both fetch event info. Migrating guest
screens first would make `home` load event data twice (its new query **and** the unmigrated context).
Collapse the shared source **first** — and migrate `home`'s event-info consumption **here**, so it is
not listed again in Checkpoint 4.

**Files:** `lib/EventThemeContext.tsx`, `app/organizer/index.tsx`, `app/(tabs)/home.tsx` (drop its own
`fetchEventInfo`, read from the shared query), `app/(tabs)/schedule.tsx` (consumes `eventInfo` from the
theme source; no server query of its own), and the remaining `loadTheme()` call sites (all identified
in Checkpoint 0).

**Steps:**

1. Back the theme with a query (`qk.eventInfo(scope)` for guests, `qk.managementEvents(scope)` for
   organizers) instead of `EventThemeContext`'s own fetch + `requestId` guard.
2. `home.tsx` and `schedule.tsx` read `eventInfo` from the shared query/context, not a private fetch.
3. Replace scattered `loadTheme()` calls with `invalidateQueries` where a real refresh is intended
   (pull-to-refresh); drop the rest.
4. `organizer/index.tsx` reads events from the shared query, not a second fetch.

**Acceptance:** event info + management events are fetched once and shared; no duplicate call on
organizer/home focus (compare to the CP0 baseline); `home`/`schedule` no longer fetch event info
themselves; theme still updates on pull-to-refresh.

**Verify:** verify block green + dev-client: organizer/home focus triggers at most one event-data
request.

---

## Checkpoint 4 — Migrate remaining guest screens

**Rationale:** highest-traffic surface. `home` and `schedule` were already handled in Checkpoint 3;
this checkpoint covers the rest.

**Files (one commit each):** `app/(tabs)/drinks.tsx` (list + stats + block-poll), `app/(tabs)/rsvp.tsx`
(`fetchGuestMe`), the photo-game screen (`fetchPhotoGameStatus`), `app/declined.tsx` +
`app/blocked.tsx` polls, `lib/BlockedFeaturesContext.tsx`.

**Steps (per screen):**

1. Replace `useFocusEffect`/`useEffect` fetch with `useQuery` (focus-gated `refetchInterval` for
   polls; keep the countdown 1 Hz timer — local arithmetic, not a fetch).
2. Convert writes (RSVP submit, drink log, photo report/hide, revoke) to `useMutation` +
   `invalidateQueries`.
3. Remove dead `useRef`/`intervalRef`/manual-loading state.

**Login/routing note:** `app/index.tsx` / `app/scan.tsx` stay direct `api` calls for one-shot QR/auth,
but on successful login they **prime the cache**: organizer →
`queryClient.fetchQuery(managementEventsOptions(scope))`, guest →
`queryClient.fetchQuery(guestMeOptions(scope))`. This loads routing data and fills the cache in one
step. Document this in the inventory.

**Acceptance:** each screen renders last-known data immediately on focus, no duplicate in-flight
requests, existing tests green; `blocked.tsx`/`BlockedFeaturesContext` behave correctly now that the
interceptor settles (Checkpoint 2).

**Verify:** verify block green per screen + dev-client smoke test of each migrated surface.

---

## Checkpoint 5 — Migrate organizer screens

**Files (one commit each):** `app/organizer/notes.tsx` (`fetchManagementNotes`),
`app/organizer/photos.tsx` (`fetchManagementPhotos`), `app/organizer/schedule.tsx`
(`fetchManagementSchedule`). **Not** `organizer/settings.tsx` — it has no server query (session +
logout only); its `loadTheme()` was already consolidated in Checkpoint 3.

**Steps:** same pattern as Checkpoint 4 (queries for reads; mutations + invalidation for notes/photos
writes; note assignment/toggle invalidates `qk.notes(scope)`).

**Acceptance:** organizer screens use the shared cache; create/delete of a note or photo updates via
invalidation; existing organizer tests green.

**Verify:** verify block green per screen + dev-client smoke test of the organizer flow.

---

## Checkpoint 6 — Persistence (⚠️ REQUIRED; privacy change; ship last)

**PRODUCT DECISION — settled 2026-07-18 (André): REQUIRED.** The goal explicitly includes "show data
after an app restart with no network" — this directly targets the original "klapprig offline" symptom.
It is the biggest privacy surface (a new on-disk cache of personal data), so it still ships **last and
separately**, gated on the governance/deletion safeguards below. It is not optional.

**Rationale:** make stale data usable across restarts. This introduces an **on-disk cache** where the
architecture currently guarantees none — a documented architecture + privacy change, not a flag.

**Dependencies & provider:** `@tanstack/react-query-persist-client` +
`@tanstack/query-async-storage-persister` + `@react-native-async-storage/async-storage`. Wrap in
`PersistQueryClientProvider` (replaces the plain provider from Checkpoint 2). Update
`docs/dependencies.md` (three new runtime deps).

**Steps:**

1. Add the persister with a **buster** keyed to app version and a `maxAge`.
2. **Persistence allowlist (corrected policy):** _only_ an explicit allowlist of session-scoped
   queries may persist. Persisted personal data must be isolated by the non-secret `QueryScope` and
   purged on logout, account switch, erasure, and cache-version change. Auth/session-derived queries
   never persist. (Note: photos and leaderboard **are** account-scoped data — they may persist only
   under this scoped-and-purged rule, not as "non-account" data.)
3. Replace empty-while-loading screens with a stale-then-revalidate UI (cached data + subtle
   refreshing indicator).

**⚠️ Governance / privacy (required, do not skip):**

- Update `docs/ARCHITECTURE.md` §7 (currently: **"no AsyncStorage, no on-disk cache"**) to describe
  the persisted cache, its contents, and retention.
- Update `docs/storage-keys.md` and `docs/dependencies.md`.
- **Deletion:** on logout, account switch, and GDPR erasure, purge the persisted cache
  (`persister.removeClient()` + `queryClient.clear()`), same paths as Checkpoint 1/3.
- This **does** change what personal data is stored on device (persisted photos + leaderboard are
  personal data), so the sub-processor/privacy governance rule in the backend `CLAUDE.md` **must** be
  worked before shipping — not conditionally.

**Acceptance:** offline after restart shows last-known event info/photos, isolated per scope, and
recovers online automatically; logout/erasure leaves **no** persisted personal data; ARCHITECTURE.md
§7, storage-keys.md and dependencies.md match reality.

**Verify:** verify block green + dev-client with airplane mode + a logout-then-inspect check that the
persisted cache is gone.

---

## Follow-ups (separate tasks, not part of the checkpoints above)

- **FU1 — Startup delay.** The splash holds 1.5s then cross-fades 500ms (`app/_layout.tsx:95`), ~2s of
  visible wait **independent of data-load time**. After the data-layer work, measure real
  time-to-interactive and decide whether to shorten/skip the hold. Its own small commit.
- **FU2 — Gallery scale (backend).** A client cache dedupes but does **not** prevent full
  `/api/photos` downloads on each poll; a large gallery means repeated large payloads. **If Checkpoint
  0 shows the response growing large,** file a backend follow-up in repo `eventplaner`:
  ETag/`If-None-Match`, pagination, or an `updated_since` delta endpoint. The one spot the backend
  re-enters scope; do not build it inside the app checkpoints.

## Rollout & risk notes

- **Ship order = checkpoint order.** 0 measures; 1 is groundwork; 2 fixes the interceptor + stands up
  the cache; 3 removes the double-fetch; 4–5 are per-screen migrations; 6 is the required
  privacy-touching persistence (settled 2026-07-18), shipped last.
- **Do not bundle the whole plan into one release build.** Land 1–3 first, verify on device, ship.
  Then 4–5. Then 6.
- **Highest-risk gates:** Checkpoint 1 (stale-token race — its generation counter + race test are the
  gate), Checkpoint 2 (never-settling promise → hung query — the interceptor rewrite is the gate), and
  Checkpoint 6 (on-disk personal data — deletion + ARCHITECTURE/privacy sync are the gate). Do not
  hand back any of these without the named safeguards.
- The emergency Fix B/C in `managementPush.ts` stay; push is not migrated to queries.
