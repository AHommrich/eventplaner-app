<!--
Thanks for the contribution. This checklist mirrors the standards documented
in `docs/REFACTOR_PLAN.md`. Leave every item ticked or explicitly N/A —
untouched checkboxes will block review.
-->

## Summary

<!-- One paragraph: what changes and why. Keep it short. -->

## Motivation

<!-- Optional. Link to the ticket, incident or discussion that triggered this
change. If the change is a follow-up from `docs/REFACTOR_PLAN.md`, link the
section. -->

## Changes

- [ ] New files listed below (relative paths).
- [ ] Existing files touched below (relative paths + one line each on how).

## Verification

- [ ] `nvm use` (Node 20) applied.
- [ ] `npm install --legacy-peer-deps` run if `package.json` changed.
- [ ] `npm run typecheck` green.
- [ ] `npm run lint` green (warnings allowed for now — see follow-ups).
- [ ] `npm run test` green.
- [ ] `npm run test:coverage` green (thresholds in `jest.config.js`).
- [ ] If the change touches a Maestro selector (button label, screen title,
      tab name), the affected `.maestro/*.yaml` flow updated to match.
- [ ] Manual smoke on Expo Go (iOS or Android) — walk through
      `scan → login → RSVP → home → all tabs`. For anything auth-adjacent,
      run `maestro test .maestro/solo-login.yaml .maestro/logout.yaml`
      once. Note anything unusual below.

## DSGVO gate

Any "yes" below **requires** the paired doc/copy update in the same PR.

- [ ] Touched `expo-secure-store` (any `SecureStore.setItemAsync`) → updated
      [`docs/storage-keys.md`](../docs/storage-keys.md).
- [ ] Added / changed a runtime dependency (`package.json` `dependencies`) →
      updated [`docs/dependencies.md`](../docs/dependencies.md) and re-ran
      [`tests/regressions/no-tracking.test.ts`](../tests/regressions/no-tracking.test.ts).
- [ ] Added a new processing purpose (upload, share, log) → added a
      `ConsentGate` and a `ConsentKey` in [`lib/consents.ts`](../lib/consents.ts).
- [ ] Changed personal-data flow → updated the backend privacy notice
      (Laravel repo) **and** verified the app's `Settings → Datenschutzerklärung`
      renders the new copy in DE + EN.
- [ ] Added a new screen that stores or displays personal data → mentioned in
      [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

## Screenshots / recordings

<!-- For any user-visible change, attach a screenshot from Expo Go. Compare
against the pre-change state if the diff is subtle. -->

## Rollback plan

<!-- Optional. If the change is risky, describe how to roll back — usually
"revert this PR" is enough for the app; call out anything that touches
persisted data. -->

## Follow-ups

<!-- Anything discovered during the PR that is out of scope. Copy to
`docs/REFACTOR_PLAN.md → Follow-ups` after merge. -->
