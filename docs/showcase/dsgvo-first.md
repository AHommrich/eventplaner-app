# DSGVO-first architecture

**One-liner:** GDPR / DSGVO isn't a settings screen appended at the end —
it's the constraint that shaped which packages we allow, how sessions are
stored, and what the network graph looks like.

## The constraint

The app runs at a real wedding in Germany. Wedding guests are private
individuals, the data they hand over (photos, RSVP, drinking behaviour) is
sensitive by any reasonable interpretation, and — since the app is public
on GitHub — nothing about the design can be safely hidden behind
obscurity. Everything a compliance auditor would want to see must be
visible in the tree.

That framing has consequences that were made *before* a single screen was
laid out.

## The four subsystems

### 1. Consent surfaces (Art. 6 + 7)

Every processing purpose that isn't strictly necessary for the app to
function sits behind a `ConsentGate`
([`components/ConsentGate.tsx`](../../components/ConsentGate.tsx)). Today
that gate covers two purposes: photo upload
(`photo_upload`) and photo game submission (`photo_game`).

The gate is a Provider + hook, not a wrapper component. Callers keep
using their existing `onPress` handlers; they just guard the entry point
with a one-liner:

```ts
const { ensureConsent } = useConsentGate();
async function handleUpload() {
  if (!(await ensureConsent('photo_upload'))) return;
  // …existing upload code
}
```

Design decisions worth calling out:

- **Timestamped in SecureStore, not just a boolean.** The
  [`lib/consents.ts`](../../lib/consents.ts) module writes `granted_at`
  alongside every `true`. That timestamp is what makes the consent
  "provable" — Art. 7 (1) requires you to be able to show *when* consent
  was given, not just *that* it was.
- **Revocation is a first-class screen** — `Settings → Einwilligungen
  verwalten` at [`app/consents/index.tsx`](../../app/consents/index.tsx).
  Art. 7 (3) says revocation must be as easy as granting; a hidden setting
  or a "contact us" address does not clear that bar.
- **One modal at a time.** The Provider only holds one pending promise;
  two `ensureConsent` calls racing would produce a queued dialog that
  confuses guests. Today's screens never trigger that, so the simple
  state machine wins over a fancier queue.

### 2. Data-subject rights (Art. 15 + 17)

- **Art. 15 (data export)** — [`app/data-export.tsx`](../../app/data-export.tsx)
  calls `GET /api/guest/export`, receives a JSON document with every
  personal field the backend still has on file, and hands it to the
  system share sheet via `expo-sharing`. No account creation, no email
  loop; the guest gets the data on the device that authenticated the
  session.

- **Art. 17 (erasure)** — [`app/erasure-pending.tsx`](../../app/erasure-pending.tsx)
  is the interesting one. Immediate hard delete is *not* what a wedding
  guest actually wants — they may hit the button by accident and lose
  their RSVP + uploaded photos with no recourse. The design chosen
  instead:
  1. Tapping "Delete my data" posts `POST /api/guest/erasure`.
  2. Backend schedules a hard delete for 30 days from now and returns a
     `recovery_token` in the same response.
  3. The client stores the token in SecureStore under `erasure_*` keys
     and drops the guest on the pending screen.
  4. Any time in the 30-day window, the guest can revoke via the same
     screen — `POST /api/guest/erasure/revoke` restores the account.
  5. After the window, retention jobs on the backend actually purge the
     data.
  
  The 30-day soft delete is longer than DSGVO strictly requires, but it
  matches what users expect from mainstream apps and preserves the
  ability to fix accidents. That's the trade the design bets on.

### 3. Data-minimisation posture

DSGVO Art. 5 (1) (c) is where most apps quietly fail — an analytics
package here, a crash reporter there, and suddenly there's a third-party
processor list nobody agreed to. The posture picked here is deliberately
absolutist: **zero third-party runtime traffic**.

- **Fonts**: 10 Google Fonts locally bundled via `@expo-google-fonts/*`.
  This is not a performance choice — it's a DSGVO one. Serving the same
  fonts from `fonts.gstatic.com` triggered the 2022 German case-law wave
  on font hosting. The audit lives in
  [`docs/dependencies.md`](../dependencies.md).
- **QR decoder from gallery images**: the app has to run jsQR to read a
  QR from a photo the guest picked from their library. There is no
  first-party native module that does this on both platforms, so an
  invisible `WebView` is used. Previously the WebView pulled jsQR from
  `cdn.jsdelivr.net`; that was the *only* runtime third-party network
  call the app made. It's now vendored offline as
  [`lib/vendor/jsQRSource.ts`](../../lib/vendor/jsQRSource.ts), inlined
  into the WebView HTML at bundle time. See
  [`scripts/vendor-jsqr.mjs`](../../scripts/vendor-jsqr.mjs) for the
  regeneration script.
- **Enforcement, not aspiration**: the posture is checked automatically
  by [`tests/regressions/no-tracking.test.ts`](../../tests/regressions/no-tracking.test.ts),
  which fails CI if any known analytics / crash-reporting package name
  appears in `package.json` OR any public-CDN hostname reappears in the
  source tree. A vendored library that starts referencing a CDN would
  trip the test on the next `npm run test`.

### 4. Storage discipline

Every persistent value lives in `expo-secure-store` (Keychain on iOS,
Keystore on Android). No `AsyncStorage`, no plain JSON files in the app
sandbox. The [`docs/storage-keys.md`](../storage-keys.md) file is a full
audit: each key gets `purpose`, `retention`, and a "cleared on logout?"
column. When a screen adds a new `SecureStore.setItemAsync`, the PR
template refuses to merge without an update to that file.

## What was rejected

- **Cookie-banner style consent**: a single modal on first launch that
  toggles "photos on/off". Rejected because Art. 7 (2) requires informed
  consent per purpose — a single toggle covering multiple processing
  activities is legally a "bundled consent" and is invalid.
- **Analytics with anonymisation**: no. Even IP-anonymised analytics
  ships a foreign SDK to a guest phone. The value it would deliver — a
  couple's curiosity about which screens got looked at — is not worth
  the compliance surface.
- **Sentry / crash reporting**: same argument, plus the fact that
  crashes at a wedding are a rare event, not a data-informed engineering
  problem. If a crash happens, the couple will hear about it.
- **Auto-delete on logout instead of the 30-day window**: rejected
  because a guest who logs out to hand the phone to a partner should not
  be treated as a delete request. Explicit erasure is a different intent.

## Where to read next

- [`docs/ARCHITECTURE.md § 9 — Privacy and DSGVO`](../ARCHITECTURE.md)
  for how the pieces are wired.
- [`docs/dependencies.md`](../dependencies.md) for the runtime-dep audit
  that backs the "zero third-party traffic" claim.
- [`docs/storage-keys.md`](../storage-keys.md) for the per-key retention
  table.
- The two enforcement tests:
  [`tests/regressions/no-tracking.test.ts`](../../tests/regressions/no-tracking.test.ts)
  and
  [`tests/vendor/jsqr-source-sync.test.ts`](../../tests/vendor/jsqr-source-sync.test.ts).
