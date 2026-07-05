# Two-step QR authentication

**One-liner:** No passwords, no accounts, no email loop — but also no
shared token that a whole family reuses across ten devices.

## The constraint

Wedding guests are not repeat users. They open the app once, maybe use
it a few times over one weekend, and never sign in again. Any
authentication mechanism that requires them to *remember* something
after the wedding is friction that nobody wants.

But there's a second constraint pulling in the opposite direction: a
family (`Familie Caspari`) arrives with **one invitation card** for the
whole family. If the QR on that card was a single bearer token, the
first person to scan would consume it and lock the rest out. If it was
a token shared across the family, we'd have five people writing RSVPs
that all attribute to the same `guest_id` in the backend — the drink
game, the RSVP list, and the photo game would all be nonsensical.

So the flow has to be **passwordless** but also **per-guest**, resolved
in a way that a wedding guest can complete with one hand while holding
a champagne glass.

## The chosen flow

Two API calls, gated by whether the invitation is solo or family:

### Solo invitation

1. Client scans the QR → extracts the trailing token → calls
   `GET /api/auth/qr/{token}`.
2. Backend returns `{ type: 'solo', family_name: null, guests: [{ token: '…' }] }`.
   The guest's per-guest bearer token is included in step 1's response.
3. Client saves `guests[0].token` to SecureStore and navigates to home.

One request. No picker. The invitation itself is the only auth factor.

### Family invitation

1. Same first call. Backend returns
   `{ type: 'family', family_name: 'Caspari', guests: [{ token: null, is_active: false }, …] }`.
   Notably every `token` field is `null`.
2. Client renders a bottom-sheet picker with the family members' names.
3. Guest taps their name → client calls
   `POST /api/auth/qr/{token}/select { guest_id: 42 }`.
4. Backend mints a per-guest bearer token, marks that slot as claimed,
   and returns the token.
5. Client saves and navigates.

The QR is a **family-scoped ticket**; the picker resolves the ticket to
a specific guest. Once a slot is claimed, the picker on any other
device shows it as `is_active: true` — greyed out, not tappable.
Another device tries to claim it anyway? Backend returns 409, client
marks the row locally as `is_active: true` and shows an alert; guest
picks a different name.

## What was rejected

- **Per-guest QR on the invitation card.** Would remove the picker
  entirely, at the cost of forcing the couple to print
  individually-personalised cards for every family. Wedding stationery
  is a design object; every family gets one card by convention. Doing
  one card per guest would also encourage guests to swap cards ("give
  me André's, I'll do his RSVP for him"), silently poisoning the
  attendance list.
- **Passwords or one-time email codes.** A guest opening the app once
  should not need an inbox. Email-based recovery was rejected because
  the backend has an email address on file for exactly the family, not
  each individual guest.
- **Deep-link magic that logs in on tap.** Considered and rejected —
  we'd need the guest's phone to open the app instead of the browser
  and the invitation cards are physical, not digital.

## Non-obvious design choices

**No token expiry.** Once a guest is logged in, the bearer stays valid
until they explicitly log out. The wedding lasts three days;
re-authenticating in the middle of the event would break the drink game
and the photo game. The trade-off — a lost phone stays authenticated
until the guest changes their mind — is acceptable because the token
only unlocks wedding-specific data, not identity or payment.

**Slot-locking, not device-locking.** A guest can log in on multiple
devices *if they scan the QR again first* — the 409 protects against a
different family member claiming that slot, but the same guest coming
back from a lost-phone situation just re-scans and picks their name.
Backend re-issues a token for the same `guest_id`.

**QR from photo, not just camera.** The
[`lib/QrFromImage.tsx`](../../lib/QrFromImage.tsx) module lets a guest
pick a *photo* of their invitation from the gallery. The couple's
invitation photos posted in the family group chat still work. This is
the surface that used to have the one non-DSGVO-compliant CDN dependency;
see [`dsgvo-first.md`](dsgvo-first.md) for how that was neutralised.

**RSVP status is orthogonal to auth.** After a successful login the
welcome screen probes `GET /api/guest/me` and redirects based on
`rsvp_status`:

| Status | Destination |
|--------|-------------|
| `null` (never answered) | `/rsvp` — onboarding RSVP screen |
| `accepted` / `accepted_pending` | `/(tabs)/home` |
| `declined` / `declined_pending` / `revocation_requested` | `/declined` |

A declined guest can still log in — they can revoke the decline, but
they don't get the full tab bar. This is enforced in
[`app/index.tsx`](../../app/index.tsx) exactly once, not scattered
across every tab guard.

## Testing surface

- [`tests/app/scan.test.tsx`](../../tests/app/scan.test.tsx) covers
  both the solo path and the family picker + 409 case.
- [`tests/app/index.test.tsx`](../../tests/app/index.test.tsx) covers
  the session probe and the `rsvp_status` redirect matrix.
- End-to-end, [`.maestro/solo-login.yaml`](../../.maestro/solo-login.yaml)
  runs the solo path against a real device using the `__DEV__` token
  input at the bottom of the scan screen. Family is not E2E-tested
  because reproducing the picker + 409 needs seed guests the flow
  cannot depend on.

## Where to read next

- The client contract:
  [`app/scan.tsx`](../../app/scan.tsx) +
  [`app/index.tsx`](../../app/index.tsx).
- The session helpers:
  [`lib/auth.ts`](../../lib/auth.ts).
- The backend endpoints table in [`CLAUDE.md`](../../CLAUDE.md).
