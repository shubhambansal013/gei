# Claude memory — project-scoped

Context files that Claude Code (and equivalent AI assistants) can load when working on this repo. The index is `MEMORY.md`; individual facts live alongside it.

## How it works

Each file has YAML frontmatter (`name`, `description`, `type`) and a short body. `type` is one of:

- **user** — who's at the keyboard and how they like to work. Tailor responses accordingly.
- **project** — facts about this codebase, its conventions, or active initiatives. Orient work around them.
- **feedback** — rules the team has converged on. Follow them.
- **reference** — pointers to where information lives (e.g. issue tracker).

## Editing these files

- Safe to edit / add / remove when a convention changes or a new preference emerges.
- If a fact conflicts with what you observe in the code, trust the code and update the file.
- Don't commit secrets here. These files live in git.

## Where to pick up

When starting a session on this repo, read:

1. `../../CLAUDE.md` — binding invariants and working rules.
2. `../../HANDOFF.md` (if present) — most recent session pick-up notes.
3. `MEMORY.md` here — team preferences and conventions.
