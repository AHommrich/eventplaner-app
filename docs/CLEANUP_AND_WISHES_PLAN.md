# Cleanup & Wishes Plan — App (eventplaner-app)

Created: 2026-07-19 · Tool-agnostic (executable by Codex or Claude Code).
Companion plan for the backend repo: `eventplaner/docs/TESTFLIGHT_CLEANUP_PLAN.md`.

## Why this exists / constraints (read first)

- Device testing on 2026-07-19 surfaced 3 bugs + 1 UX wish.
- **Build economics:** exactly **one EAS build left until the 1.8. reset**, and the
  slot is consumed at **`eas build`** (not at submit). So: do everything that needs
  **no** build first, verify in **Expo Go against staging** (`beta.hommrich.app`)
  and — if one is already installed — an **existing dev-client** via
  `npx expo start --dev-client` (no new build). Spend the ONE build only on the
  final production/TestFlight binary.
- **Backend endpoint differs per client:** Expo Go → staging; the TestFlight binary
  → `eveplan.de` (production). The two backend fixes (C1 report mail, C2 legal —
  see companion plan) must be live on **production** before the final TestFlight
  smoke test, or the bugs reappear there.
- Order: **C1 + C2 (backend, no build)** → **C2b + C3 + Item 1 (app, JS-only, test
  in Expo Go / dev-client)** → full green preflight → the one production build.
- Do the tab-swipe wish (W1) **later**, on its own branch, after the build.

---

## C2 — Legal screens "blank" = invisible (low-contrast) text · P1 (JS-only)

**RE-DIAGNOSED 2026-07-19 (was assumed backend):** `curl` proves both staging and
production return the correct sections (imprint 6, privacy 7). The API is healthy.
The reported "blank" screen is actually **invisible text**: in `app/legal/imprint.tsx`
and `privacy.tsx` the section heading + body render with `color: colors.cardText`,
but the content sits directly on `colors.screenBg` (the ScrollView has no card
background). On the couple's olive organizer theme `cardText` is a light/cream tone →
invisible on the beige `screenBg`. (Confirmed by the visible scrollbar in the
screenshot — content is present, just unreadable.) This is the **same class as C3**.

**Fix (pick one, keep it consistent with the app's card design):**

- Preferred: render the legal sections inside a **card surface** (`backgroundColor:
colors.card`, text `colors.cardText`) — then `cardText` is on its intended surface
  and is guaranteed legible; matches the rest of the app. Also fix the small
  "Zuletzt aktualisiert" line + the offline/error states (they use
  `theme.colors.muted` on `screenBg`).
- Or: give on-`screenBg` text a color that contrasts with `screenBg` specifically.
- Apply to BOTH `app/legal/imprint.tsx` and `app/legal/privacy.tsx`.

**Defensive extra (optional, still worth doing):** in `lib/legal.ts`, treat a 200
with empty/missing `sections` as failure → fall through to stale cache → bundled
fallback (`constants/legal-fallback.ts` has content). Prevents a future backend
glitch from blanking the screen.

**Verify:** in Expo Go with the olive theme, open Impressum + Datenschutz → all
sections clearly legible. JS-only.

**Backend nit (not app):** the API's `updated_at` returns "now" instead of the
front-matter date — cosmetic, tracked in the backend plan, not blocking.

---

## C3 — Contrast: hint / placeholder / secondary text unreadable · P2 (JS-only)

**Symptom (screenshots):** on the **olive soft-luxury organizer theme**, secondary
text is barely legible — organizer home push hint + "Owner" role + email; the
"Neuer Eintrag" placeholders ("Titel", "Beschreibung (optional)"); "Zugewiesen an",
empty-state lines, etc.

**Root cause (confirmed):** these use the **static** `theme.colors.muted` (`#7A6A5A`,
a warm grey tuned for the **beige guest theme**) painted **on dynamic event-theme
cards** (`colors.card` = olive for soft-luxury). The static grey does not adapt to
the card colour → fails contrast. Guest placeholders use `colors.cardText + '88'/'aa'`
(borderline on some palettes).

**Fix approach:**

- Derive on-card secondary/placeholder colour **from the event theme**, not the
  static `muted`. Simplest: use `colors.cardText` at a higher alpha for hints (e.g.
  `+ 'CC'`) and a stronger placeholder alpha (aim ~4.5:1). Cleaner: add a
  `mutedOnCard` role to `EventThemeColors` in `lib/EventThemeContext.tsx`, computed
  once, and consume it.
- Replace static `theme.colors.muted` for **on-card** secondary text + placeholders
  in: `app/organizer/index.tsx` (`pushHint`, `role`, `email`), `app/organizer/notes.tsx`
  (`placeholderTextColor`, `noteBody`, `meta`, `empty`, `fieldLabel`), `app/organizer/
photos.tsx`, `app/organizer/schedule.tsx`. Re-check guest placeholders in
  `app/(tabs)/photos.tsx` (`cardText + '88'`) and `app/(tabs)/drinks.tsx`
  (`cardText + 'aa'`).
- Do NOT change `theme.colors.muted` globally where it sits on the neutral app
  background (it's fine there); only fix the on-card usages.

**Verify:** in Expo Go, switch an event to soft-luxury (olive) AND classic (beige);
confirm hints/placeholders/role labels are clearly legible on both. Pure styling →
low risk, JS-only.

---

## Item 1 — Boot / restore gate (the known open race) · P1 before the build

**✅ IMPLEMENTED 2026-07-19 (needs device verify).** `app/_layout.tsx` now wraps the
tree in `PersistQueryClientProvider` (client + `persistOptions` exported from
`lib/queryPersistence.ts`); the splash is held until fonts + session-prime + on-disk
cache-restore are all done (new `restored` state set by `onSuccess`/`onError`), so no
empty→restored flash and queries stay paused (`isRestoring`) during restore. The
`<Stack>` is kept always-mounted (expo-router safety) rather than unmounted; the
splash overlay covers it. The standalone `initQueryPersistence()` call was removed
(the provider owns restore; the function stays for its test). typecheck/lint/prettier
green, coverage 90.9%. **Still MUST be device-verified** (`_layout` has no test
coverage): cold start online, cold start in airplane mode after a prior online
session (offline-after-restart shows last-known data, no white screen), login/
logout/switch.

**Original context (from `docs/APP_PERFORMANCE_DATA_LAYER_PLAN.md` "STILL OPEN"):** `app/
_layout.tsx` renders the router tree before `primeFromStore()` + the persisted-cache
restore complete (`primed` only hides the splash). This is the "offline after
restart" / cache-race risk Codex and Claude both flagged as a must-fix before the
build.

**Fix:**

- Export a `persistOptions` object (persister + maxAge + buster + dehydrateOptions)
  from `lib/queryPersistence.ts` (keep `initQueryPersistence` for the existing test).
- In `app/_layout.tsx`: replace `QueryClientProvider` with `PersistQueryClientProvider`
  (`@tanstack/react-query-persist-client`) passing `client={queryClient}` +
  `persistOptions`. Gate the router `Stack` on **`primed` AND not `isRestoring`**
  (read `isRestoring` via a small child component using `useIsRestoring()`), and keep
  the splash overlay visible until both are done so there is no white flash.
- Remove the standalone `initQueryPersistence()` call from `_layout.tsx` (the
  provider now owns restore); do not double-wire.

**Risk / verification:** `_layout.tsx` has **no test coverage** and a broken gate
white-screens the boot — so this MUST be verified on a real device (existing
dev-client via `expo start --dev-client`, or the production build's smoke test):
cold start online, cold start in airplane mode after a prior online session
(offline-after-restart shows last-known data, no white screen), login/logout/switch.
Typecheck + lint must stay green (`_layout.tsx` typechecks even without a test).

---

## Test-suite note (not a blocker, but know it)

`npm test` runs `--runInBand` and is **371 green** on a quiet machine. A pre-existing
flake hits heavy real-timer + `findBy` screen specs (`tabs-photo-game "submitted"`,
`tabs-schedule`, `organizer-schedule`) **only under CPU contention** — proven not a
data race and not caused by the recent organizer/session-cache work (they pass in
isolation; untouched suites flake too). Durable fix (separate task): fake timers on
those specs or accept `--runInBand`. Run preflight on a quiet machine; re-run a
flaked spec in isolation before treating it as a real failure.

---

## W1 — Swipe between tabs (TikTok feel) · WISH, after the build, own branch

**Feasibility:** the current expo-router bottom `Tabs` have **no** horizontal swipe.
Getting it needs a pager-backed navigator (`@react-navigation/material-top-tabs` on
`react-native-pager-view`, styled as a bottom bar) or wrapping the tab screens in a
pager — a navigation-architecture change.

**Conflicts (the user's instinct is right):**

- `components/gallery/PhotoLightbox.tsx` uses **horizontal swipe** to page photos;
  the album picker + schedule timeline are horizontal too. A global tab pager will
  fight these.
- Mitigation: edge-only pager gesture, or toggle the pager's `scrollEnabled` off
  while the lightbox / horizontal content is active; tune gesture priority.
- The **conditionally hidden tabs** (schedule/rsvp/photo-game/drinks — see
  `app/(tabs)/_layout.tsx`) must stay in sync with the pager order.
- Add haptics on tab change + an animated indicator for the "native feel".

**Risk:** medium-high (nav rewrite + gesture conflicts + regressions across all
tabs). **Do a throwaway spike/prototype first**, and only after the cleanups and the
current build. NOT part of the TestFlight build.

---

## Suggested execution order

1. Backend **C1 + C2** (companion plan) → staging → verify in Expo Go → production.
2. App **C2b + C3 + Item 1** → verify in Expo Go (staging) + existing dev-client.
3. Full green preflight (`npm run typecheck && npm run lint && npm run format:check &&
npm test`) + `maestro test .maestro` on a quiet machine.
4. Only then: the one `eas build --profile production` → TestFlight → smoke on
   `eveplan.de`. Upload ≠ public release.
