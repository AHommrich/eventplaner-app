# Project Preferences

- For this private project, provide commit messages in the existing history
  style: `type(scope): concise subject`, one blank line, then two short body
  lines indented by two spaces. Do not commit automatically unless explicitly
  asked.
- After any completed cleanup task, always include a proposed English commit
  message in that format.

## Public Portfolio Cleanup Backlog

Goal: prepare the repository for a public GitHub portfolio/showcase version.
Keep changes scoped to public-readiness, documentation consistency and small
maintainability improvements. Do not commit automatically.

### Priority 1: Must be done before public release

1. Remove or replace concrete local test tokens from `.maestro/solo-login.yaml`.
   Use `<local-solo-token>` or `MAESTRO_SOLO_TOKEN`, never a real token.
2. Replace the real Sentry DSN in `docs/RELEASE.md` with an example value.
   Do not expose real DSNs, org IDs or project IDs in public docs.
3. Review public operational details in `README.md`, `README.de.md`,
   `SECURITY.md`, `app.json`, `eas.json`, `constants/env.ts` and
   `app.config.js`. Keep, anonymize or mark as examples intentionally.
4. Review `docs/screenshots/**` and `assets/**` for personal data, real guests,
   QR codes, private names or copyrighted/private photos. Anonymize or remove
   anything unsafe.
5. Remove or anonymize internal release/store planning documents:
   `docs/POLISH_STORE_RELEASE_PLAN.md`, `docs/STORE_RELEASE.md`,
   `docs/PRE_LAUNCH_FOLLOWUPS.md` and, if needed, `docs/RELEASE.md`.

### Priority 2: Should be improved

6. Shorten and neutralize the README files. Focus on problem, tech stack,
   architecture, features, tests, privacy and setup with demo/example values.
7. Neutralize agent/process-specific docs such as `CLAUDE.md`, `AGENTS.md`,
   `.maestro/README.md` and `.github/PULL_REQUEST_TEMPLATE.md`. Remove private
   paths, personal instructions and private repo references where appropriate.
8. Fix stale or contradictory documentation, especially claims that all
   follow-ups are closed while release/follow-up docs still show open work.
9. Improve the impression of very large screen files, especially
   `app/(tabs)/drinks.tsx`, `app/(tabs)/photos.tsx` and `app/index.tsx`.
   Prefer small extractions only: helper components, pure formatting/mapping
   functions or API-adjacent logic moved to `lib/**`.
10. Review conspicuous error handling. Keep intentional silent `catch` blocks
    only when they have a clear fallback or comment. Re-check the never-resolving
    Promise strategy in `lib/api.ts` and document or improve it.
11. Review hook dependency disable comments. Keep only cases that are justified
    and locally explained.
12. Update Security/Privacy docs after cleanup so `SECURITY.md`,
    `docs/dependencies.md` and `docs/storage-keys.md` stay accurate.

### Priority 3: Optional polish

13. Add a clear demo/showcase note: what works without the backend, what API is
    expected and whether mock data exists.
14. Add a concise "Known limitations" section: backend is separate, long-lived
    QR/bearer tokens are a UX trade-off, E2E is smoke-only and store/native
    release is not fully reproducible from the public repo alone.
15. Verify license and asset rights, especially `assets/house_party.jpg`, logos
    and screenshots.
