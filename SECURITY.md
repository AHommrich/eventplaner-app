# Security Policy

Thank you for taking the time to responsibly disclose an issue. This project
ships to real wedding guests on real devices, so we take reports seriously
even though the app is small.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for anything that could be
exploited. Instead, email:

**security @ hommrich.app**

Include, if you can:

- A short description of the issue and its impact.
- Steps to reproduce (or a proof-of-concept) against the staging environment
  at `https://beta.hommrich.app` — never against production
  (`https://eveplan.de`).
- The app version / commit you tested against.
- Whether you would like public credit in the fix commit.

Encrypted mail is welcome — request the PGP key in an initial plaintext
message and we will reply with the public key.

## Scope

In scope:

- This repository (the React Native / Expo client).
- The APIs it consumes on `eveplan.de` (production) and
  `beta.hommrich.app` (staging).
- Content the app writes to the device (Keychain / Keystore entries listed in
  [`docs/storage-keys.md`](docs/storage-keys.md)).

Out of scope:

- Physical loss of an unlocked device. Guest sessions are stored in the OS
  keychain and rely on the device lock for confidentiality; a device that is
  already unlocked and handed over is not a vulnerability in this app.
- Denial-of-service against the guest phone (e.g. rendering pathological
  strings that lock the UI). Bug reports welcome as regular issues.
- Third-party services we do not depend on. The runtime dependency audit in
  [`docs/dependencies.md`](docs/dependencies.md) enumerates every SDK that
  ships to a guest phone.
- Social-engineering attacks against wedding guests. If a guest hands their
  QR invitation to a third party, that third party can log in — this is a
  documented design trade-off (no passwords, no accounts).

## Response times

We aim for the following, measured from the moment your report lands in the
inbox:

| Stage                                    | Target                                          |
| ---------------------------------------- | ----------------------------------------------- |
| Acknowledgement                          | 3 business days                                 |
| Initial triage (severity + reproduction) | 7 business days                                 |
| Fix in staging                           | 30 days (critical: sooner, best-effort)         |
| Coordinated public disclosure            | agreed with reporter, default 30 days after fix |

These are targets, not contracts. If a report needs more time (e.g. a fix
requires a backend change on the Laravel side), we will keep you updated.

## Safe harbour

We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, data destruction, or
  service disruption while testing.
- Only test against **staging** (`https://beta.hommrich.app`). Production
  testing without prior written coordination is not covered.
- Give us a reasonable time to fix the issue before public disclosure.
- Do not exploit the issue beyond what is necessary to demonstrate it.

If your research uncovers other users' data by accident, stop, delete any
copies you made, and let us know.

## What we will not do

- Bounty payouts. We are a two-person wedding project without a security
  budget. Credit in the fix commit and in the release notes is the best we
  can offer.
- Retaliate against a report even if the finding turns out to be a
  misunderstanding.
- Silently patch a real vulnerability without acknowledging the reporter.

## Non-vulnerability reports

For bugs, feature requests or UX regressions, please open a regular issue on
GitHub instead. Response times above apply only to security reports.

## Content moderation

User-generated content is limited to wedding photos and photo-game uploads.
Until the in-app report/block controls are shipped, moderation requests should
go to the same contact address listed above. Target response time for content
reports is 48 hours.

The store-release tracker in [`docs/STORE_RELEASE.md`](docs/STORE_RELEASE.md)
keeps the Apple Guideline 1.2 checklist: report content, block users, visible
support contact and backend-side filtering.

## Data-protection concerns

If you believe personal data is being processed unlawfully, please read the
in-app privacy notice (`Settings → Datenschutzerklärung`) first — the backend
serves the canonical text. If your concern is not addressed there, contact
the same address (`security @ hommrich.app`) so we can route it to the data
controller.
