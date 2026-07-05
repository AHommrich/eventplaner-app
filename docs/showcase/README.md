# Showcase — engineering narratives

Portfolio-oriented deep dives into the four decisions that shaped this
codebase. These are **not** step-by-step tutorials. They exist to explain
_why_ the app looks the way it does — the constraint, the option space,
the choice, and the trade-off that came with it.

If you're reading the repo cold, this is the right entry point. The
[`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) file describes what the code
looks like; the notes here explain what it took to get there.

| #   | Narrative                                      | Length     | Punchline                                          |
| --- | ---------------------------------------------- | ---------- | -------------------------------------------------- |
| 1   | [DSGVO-first architecture](dsgvo-first.md)     | ~180 lines | Compliance is not a screen you add at the end.     |
| 2   | [Backend-driven theme engine](theme-engine.md) | ~140 lines | One event JSON changes ten screens.                |
| 3   | [Two-step QR authentication](qr-auth.md)       | ~150 lines | No passwords, no accounts, no reuse across guests. |
| 4   | [Layered testing strategy](testing-pyramid.md) | ~170 lines | Coverage numbers are a floor, not a target.        |

Each note is self-contained — read them in any order. Cross-references
between them are explicit where the argument depends on another decision.

## What lives here vs. in `docs/`

Both directories describe the same codebase, in different registers.

- [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — the reference. What every
  layer does, how the auth flow works, which files own which contract.
  Read this to modify the code.
- `docs/showcase/*.md` — the narrative. What decisions the code embodies
  and why the alternatives were rejected. Read this to understand the
  code before touching it.

Neither replaces the other. `ARCHITECTURE.md` is what a new maintainer
needs; `showcase/` is what a reviewer looking at the repo cold needs.
