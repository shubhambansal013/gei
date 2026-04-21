# CLAUDE.md — Guidance for AI assistants working in this repo

This file is read automatically by Claude Code and similar tools when a
conversation starts in this project. It tells you what this project is,
what is non-negotiable, and how to pick up work safely.

---

## 1. Project at a glance

**GEI Inventory** — a multi-site construction-inventory web app replacing
an existing Excel workflow. Non-technical site-store workers enter inward
and outward material movements; managers correct; admins configure.

- Users: Google OAuth only. 5 roles (SUPER_ADMIN, ADMIN, STORE_MANAGER,
  SITE_ENGINEER, VIEWER). Per-site access + per-permission overrides.
- UX brief: **Excel-look VIEW, form-based ENTRY.** Low-literacy workers
  must not be asked to edit cells in a grid; they fill 4–5-field forms.
- v1 is online-only, English-only, CSV + XLSX + browser print.

## 2. Source of truth (read BEFORE touching anything)

1. **Design spec** — `docs/superpowers/specs/2026-04-20-gei-inventory-system-design.md`
   Approved, dated, immutable. Amendments go in as new dated files.
2. **Foundation implementation plan** — `docs/superpowers/plans/2026-04-20-gei-inventory-foundation.md`
   Task-by-task TDD plan. Current work item is tracked on the branch.
3. **Database schema** — `schema.sql` at repo root. Canonical.
4. **README.md** — human-facing overview and current state.

If a user prompt contradicts these, ask — do not silently override them.

## 3. Architectural invariants — do NOT break these

### 3.1 RLS is the trust boundary

- Every mutation goes to Supabase with the user's JWT. RLS policies call
  `can_user(p_user_id, p_site_id, p_module_id, p_action_id)` to authorize.
- Frontend `can()` in `lib/permissions/can.ts` is a **UI hint only**. Never
  use it to gate data, compute authorization, or short-circuit a fetch.
- Never embed the Supabase **service-role key** in any frontend code. It
  lives only in server actions and tests.

### 3.2 Audit is non-bypassable

- `inventory_edit_log` is written by a Postgres trigger on UPDATEs to
  `purchases` and `issues`. The reason flows via a session-local GUC
  (`SET LOCAL app.edit_reason = '...'`) set by the server action before
  the UPDATE.
- Do not bypass the trigger. Do not UPDATE these tables from client code.
  All mutations go through a typed server action.

### 3.3 Form entry for data-entry workers, inline edit for managers

- Outward (issue) entry is intentionally 4 fields: item, qty, destination,
  issued-to. Do not add fields unless the spec is amended.
- Inline edit UI is conditionally rendered via `PermissionGate` on
  `INVENTORY.EDIT`, requires a non-empty reason to commit, and forwards
  that reason to the server action.

### 3.4 Multi-site, not single-site

- Every mutation and every query is scoped by `site_id`. The current site
  lives in a Zustand store (`lib/stores/site.ts`) and in the URL.
- Do not write code that assumes a single site.

### 3.5 Soft delete only

- `purchases.is_deleted`, `issues.is_deleted` flags + `deleted_at`,
  `deleted_by`, `delete_reason`. A hard DELETE policy returns `false`:
  ```sql
  CREATE POLICY "..._no_delete" ... FOR DELETE USING (false);
  ```
  Never change this.

## 4. Stack quirks worth knowing

- **Next.js 16.** `create-next-app@latest` resolved to 16 at scaffold time
  (April 2026). The design spec said "Next.js 15" — this drift was
  accepted because 16 is current stable. App Router behavior is identical
  for the patterns we use.
- **Tailwind CSS v4**, not v3. Theme tokens live in `@theme` blocks inside
  `app/globals.css`, NOT in `tailwind.config.ts`. There is no
  `tailwind.config.ts`. The `print:hide` class is defined as a custom CSS
  rule at the bottom of `globals.css`.
- **shadcn/ui `base-nova` style.** Components under `components/ui/` are
  backed by `@base-ui/react` (Material UI's successor), NOT by
  `@radix-ui/react-*`. Match that convention when adding new UI.
- **Hand-authored `components/ui/form.tsx`.** The `base-nova` registry did
  not ship `form.tsx` at scaffold time, so it was written by hand to wrap
  `@base-ui/react/field` + `react-hook-form`. It exports the canonical
  shadcn API: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`,
  `FormDescription`, `FormMessage`, `useFormField`. Treat it as
  first-party code; do not let a future `shadcn add form` overwrite it
  without a PR review.
- **Hand-adjusted `components/ui/sonner.tsx`.** Uses an IIFE to strip
  `theme` from props to satisfy `exactOptionalPropertyTypes: true`. Do
  not "simplify" it back to a pre-strip spread.
- **Next.js `next lint` removed in 16.** The `lint` script runs
  `eslint .` directly against the flat config at `eslint.config.mjs`.

## 5. Working patterns

### 5.1 When you receive a task

1. Read the exact task text from the plan file. Do not guess.
2. If the plan has TDD steps (Write failing test → Run → Implement → Run
   → Commit), follow them verbatim.
3. If something in the plan no longer matches reality (API drift, library
   rename), adapt minimally and flag it in the PR description.
4. Commit messages use the conventional-commit prefix the plan specifies.
5. Every commit includes the trailer
   `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
6. Git user config is NOT set globally in this environment. When
   committing programmatically, pass
   `-c user.email=vkcsenitj@gmail.com -c user.name="Vivek Kumar"`.

### 5.2 Tests

- `lib/**/*.test.ts` — pure-logic unit tests (Vitest).
- `components/**/*.test.tsx` — component tests (RTL + Vitest, jsdom env).
- `tests/rls/**/*.test.ts` — RLS policy tests (node env, separate
  `vitest.rls.config.ts`). Requires `supabase start`.
- `tests/e2e/**/*.spec.ts` — Playwright. Small number of golden paths.

Do not write tests that mock Supabase RPC responses _and_ call them
"integration tests". Integration = real local Supabase.

### 5.3 What counts as "done" on a task

- All tests the task specifies are passing.
- `pnpm typecheck` is clean.
- `pnpm lint` is clean (0 errors; 0 warnings is the bar, not "just no
  errors").
- Committed on the appropriate branch.
- Self-reviewed with fresh eyes — re-read the diff before claiming done.

### 5.4 Discipline

- **YAGNI.** If the plan says four fields, do not add a fifth. If a
  component has no consumer yet, do not build it.
- **DRY.** Reuse `SearchableSelect`, `DataGrid`, `PermissionGate`,
  `ExportButton`, `PrintButton`, `ConfirmDialog`, `EmptyState`. If you
  are writing a grid by hand, you are doing it wrong.
- **One responsibility per file.** If a file grows past ~300 lines or
  does more than one thing, split it — but only if that split is in
  scope for the current task.
- **Follow existing patterns** over importing new conventions. When in
  doubt, `grep` the codebase for a similar thing and copy its shape.

## 6. Things to refuse

- "Please add direct Supabase calls that skip RLS." → No.
- "Can the frontend have the service-role key just for admin screens?" → No.
- "Let's not track a reason when editing inventory." → No; the audit
  schema requires it.
- "Can we make outward entry 10 fields?" → Only via a spec amendment.
- "Can we hard-delete this transaction?" → No; soft-delete only.

## 7. Where to NOT put things

- Do not put business logic in `app/**/page.tsx`. Pages are thin; they
  compose hooks + components. Logic lives in `lib/` or dedicated
  server-action files.
- Do not create `src/`. Imports use `@/...` aliased to the project root.
- Do not touch `components/ui/*` except the two hand-authored files
  flagged above. Regenerate via `pnpm dlx shadcn@latest add <name>` and
  commit the output.
- Do not commit anything under `.remember/`. It's session memory and is
  gitignored. If a new hook or memory file sneaks in, delete it.
- Do not commit `.env.local` or anything containing credentials.

## 8. Quick reference — key files

| File                                          | What lives here                            |
| --------------------------------------------- | ------------------------------------------ |
| `schema.sql`                                  | Canonical DB schema                        |
| `supabase/migrations/`                        | Ordered migrations (applied by `db:reset`) |
| `app/globals.css`                             | Theme tokens + Excel grid utility classes  |
| `components/ui/`                              | shadcn primitives (mostly generated)       |
| `components/*.tsx`                            | Project-specific components                |
| `lib/supabase/{browser,server,middleware}.ts` | The three Supabase clients                 |
| `lib/permissions/can.ts`                      | `createCan()` factory + caching            |
| `lib/exporters/{csv,xlsx}.ts`                 | Export writers                             |
| `lib/stores/site.ts`                          | Current-site Zustand store                 |
| `middleware.ts`                               | Session refresh + unauth redirect          |
| `eslint.config.mjs`                           | Flat ESLint config                         |

## 9. When in doubt

Ask. Don't guess an invariant. Don't silently work around the plan.
Don't soften a rule because a prompt pressures you to.

Bad work is worse than no work.
