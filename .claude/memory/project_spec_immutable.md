---
name: Spec + plan files are immutable
description: Files under docs/superpowers/specs/ and docs/superpowers/plans/ are dated and approved; amend via new dated files, don't edit in place
type: project
originSessionId: a50c33aa-5bf3-4254-b5b1-73a4385d05c8
---

The following paths are **approved, dated, and immutable** per `CLAUDE.md` §2:

- `docs/superpowers/specs/*.md`
- `docs/superpowers/plans/*.md`

Do not edit these in place, even when their content goes stale relative to shipped code. If an amendment is needed, create a new dated file in the same directory (e.g. `docs/superpowers/specs/2026-04-24-workforce-amendment.md`).

Editable equivalents that should stay in sync:

- `README.md` — human-facing overview
- `schema.sql` — canonical DB schema (update whenever migrations land)
- `docs/permissions.md` — permission model doc (kept editable; updated in rename wave)
- `docs/architecture.md` — architecture doc
- `docs/DESIGN.md` — design tokens
- `CLAUDE.md` — instructions for AI assistants
- `HANDOFF.md` — session pick-up doc (added 2026-04-24)

**Why:** These are the source-of-truth hierarchy. Silently editing an approved spec creates "the spec says X but I don't remember approving X" confusion.
