# Project Notes

This file is kept as a public-safe orientation note for coding agents and
contributors. Private tokens, local paths, personal workflow rules and release
credentials must stay outside the repository.

For repository-wide cleanup guidance, see [`AGENTS.md`](AGENTS.md). For current
architecture, read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## App Overview

`eventplaner-app` is an Expo / React Native guest companion app for an event.
Guests authenticate through QR tokens, then use RSVP, home, photos, photo game,
drinks and settings screens.

## Boundaries

- Do not commit real QR tokens, bearer tokens, Sentry auth tokens or reviewer
  credentials.
- Do not commit local-only setup files. Use ignored local notes for machine- or
  event-specific values.
- Keep public docs focused on architecture, privacy, setup and limitations.
- Do not commit automatically unless explicitly asked.
- After completed cleanup work, include a proposed English commit message in the
  existing project format.

## Useful References

- [`README.md`](README.md) - public project overview and setup.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - layer and flow overview.
- [`docs/showcase/`](docs/showcase/) - reviewer-oriented engineering notes.
- [`docs/dependencies.md`](docs/dependencies.md) - runtime dependency audit.
- [`docs/storage-keys.md`](docs/storage-keys.md) - SecureStore key audit.
- [`tests/README.md`](tests/README.md) - test strategy.
- [`.maestro/README.md`](.maestro/README.md) - local E2E smoke tests.
