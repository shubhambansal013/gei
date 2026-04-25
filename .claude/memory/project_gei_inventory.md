---
name: GEI project overview
description: Multi-site construction-inventory web app; Next.js 16 + Supabase + Tailwind 4; feature/foundation is the active integration branch
type: project
originSessionId: a50c33aa-5bf3-4254-b5b1-73a4385d05c8
---

**GEI** — Google-OAuth multi-site construction inventory app replacing an Excel workflow. RLS is the trust boundary. Audit is non-bypassable. Entry forms are deliberately low-field-count (3-5) for low-literacy site-store workers.

Stack specifics:

- **Next.js 16** (scaffolded 2026-04-20; drift from spec "Next.js 15" was accepted).
- **Tailwind CSS v4** with tokens in `@theme` inside `app/globals.css` — no `tailwind.config.ts`.
- **shadcn/ui `base-nova` style** backed by `@base-ui/react` (not Radix). Two hand-authored files: `components/ui/form.tsx` and `components/ui/sonner.tsx` — don't regenerate.
- **Supabase**: three clients in `lib/supabase/{browser,server,middleware}.ts`. Service-role key NEVER in frontend.
- **vitest** with two configs — `vitest.config.ts` for unit/jsdom (excludes `tests/rls`), `vitest.rls.config.ts` for RLS tests against local Supabase.

Source-of-truth order for invariants (per `CLAUDE.md` §2):

1. `docs/superpowers/specs/2026-04-20-gei-inventory-system-design.md` (immutable)
2. `docs/superpowers/plans/2026-04-20-gei-inventory-foundation.md` (immutable)
3. `schema.sql` at repo root (canonical)
4. `README.md`

`feature/foundation` is the active integration branch — commits land direct, no PRs.
