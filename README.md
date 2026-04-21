# GEI Inventory

Construction-site inventory management for GEI. Replaces the legacy Excel
workflow with a multi-site, role-scoped, auditable web application while
preserving the Excel _feel_ that site-store workers are familiar with.

## Core principles

- **Excel-look VIEW, form-based ENTRY.** Tables mimic Excel (gridlines,
  frozen header/first column, row numbers, keyboard nav). Data entry is
  a guided form with 4–5 fields at a time. Inline grid edit is gated to
  managers only (`INVENTORY.EDIT`) and every edit captures a reason.
- **RLS is the trust boundary.** The browser talks to Supabase directly;
  every query is guarded by Postgres Row-Level Security calling
  `can_user(user_id, site_id, module, action)`. The frontend's `can()` helper
  is a UI hint, never a gate.
- **Audit is non-bypassable.** Edits to `purchases` and `issues` fire a
  Postgres trigger that writes the before/after JSON plus the actor and a
  reason into `inventory_edit_log`. A compromised client cannot skip it.
- **Multi-site from day one.** Users get a global role and per-site
  role/override assignments via `site_user_access` and
  `site_user_permission_overrides`.

## Source of truth

Before changing anything, read:

1. **Design spec** — `docs/superpowers/specs/2026-04-20-gei-inventory-system-design.md`
2. **Foundation implementation plan** — `docs/superpowers/plans/2026-04-20-gei-inventory-foundation.md`
3. **Database schema** — `schema.sql`
4. **CLAUDE.md** — conventions for AI assistants working in this repo

Spec and plan are treated as living documents. Amendments go in via new
dated files under the same directories, not by rewriting history.

## Tech stack

| Layer               | Choice                                                                |
| ------------------- | --------------------------------------------------------------------- |
| Frontend            | Next.js 16 (App Router), TypeScript strict, React 19                  |
| Styling             | Tailwind CSS **v4** (not v3 — token syntax differs)                   |
| UI primitives       | shadcn/ui `base-nova` style → backed by `@base-ui/react` (not Radix)  |
| Data grids          | TanStack Table v8                                                     |
| Forms               | React Hook Form + Zod                                                 |
| Data fetching       | TanStack Query v5 + Supabase JS                                       |
| Backend / DB / Auth | Supabase (Postgres + RLS + Google OAuth)                              |
| Exports             | `exceljs` (XLSX), native string writer (CSV)                          |
| Testing             | Vitest + RTL (unit/component), Supabase local (RLS), Playwright (e2e) |
| Package manager     | pnpm 9                                                                |
| Node                | ≥ 20.11                                                               |

Why these choices — see `docs/superpowers/specs/…-design.md` §5.

## Quick start

```bash
# prerequisites: Node ≥ 20.11, pnpm ≥ 9, Supabase CLI, Docker

pnpm install
cp .env.local.example .env.local                 # (file created in a later task)
# paste Supabase + Google OAuth keys

supabase start                                    # local Postgres + Auth
pnpm db:reset                                     # applies all migrations
pnpm dev                                          # http://localhost:3000
```

> **First SUPER_ADMIN.** New Google sign-ups default to `VIEWER`. After
> your first sign-in, run this in Supabase Studio's SQL editor:
>
> ```sql
> UPDATE profiles SET role_id = 'SUPER_ADMIN' WHERE id = '<your-uid>';
> ```

## Scripts

| Command           | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `pnpm dev`        | Next.js dev server                       |
| `pnpm build`      | Production build                         |
| `pnpm typecheck`  | `tsc --noEmit` — must pass before commit |
| `pnpm lint`       | ESLint (flat config)                     |
| `pnpm format`     | Prettier `--write .`                     |
| `pnpm test`       | Vitest (unit + component)                |
| `pnpm test:watch` | Vitest watch mode                        |
| `pnpm e2e`        | Playwright                               |
| `pnpm db:start`   | `supabase start`                         |
| `pnpm db:reset`   | Re-apply all migrations from a clean DB  |

Husky pre-commit runs `lint-staged` + `typecheck` on every commit.

## Repo layout

```
app/                        Next.js App Router routes
  (auth)/login, pending     Public auth screens
  (app)/…                   Protected app screens (dashboard, inventory, masters)
components/
  ui/                       shadcn-generated primitives — do not edit by hand
  *.tsx                     Project components (SearchableSelect, DataGrid, …)
lib/
  supabase/                 Browser + server + middleware clients + generated types
  permissions/              can() + PermissionGate logic
  exporters/                csv.ts + xlsx.ts
  stores/                   Zustand stores (site switcher)
middleware.ts               Session refresh + auth redirect
supabase/
  migrations/               SQL migrations, ordered by timestamp filename
  seed/                     Bootstrap SQL (reference data, first site)
tests/
  rls/                      RLS policy tests (Supabase local, node env)
  e2e/                      Playwright smoke + golden paths
docs/
  superpowers/specs/        Approved design docs (dated)
  superpowers/plans/        Implementation plans (dated)
  architecture.md           System overview (coming in Task 22)
  permissions.md            Role × module × action matrix (Task 22)
  runbooks/                 Ops runbooks (Phase 3)
.remember/                  Claude Code session memory — gitignored, do not edit
```

## Current state (as of Foundation Plan execution)

**Done on `feature/foundation`:**

- [x] Task 1 — Next.js 16 + TS strict scaffold
- [x] Task 2 — shadcn/ui (base-nova) + Tailwind v4 + Excel-feel utility classes
- [x] Task 3 — Prettier + ESLint + Husky + lint-staged
- [x] Task 4 — Vitest + React Testing Library
- [x] Task 5 — Playwright config (smoke spec added with login page)
- [x] Task 6 — Supabase local + base schema migration (20 tables verified)
- [x] Task 7 — Schema additions (`reorder_level`, `issues.rate`, `updated_at` triggers)
- [x] Task 8 — `inventory_edit_log` + audit triggers (end-to-end verified)
- [x] Task 9 — Masters RLS policies (items, parties, sites, profiles, site_user_access)
- [x] Task 10 — RLS test harness + first policy tests
- [x] Task 11 — Supabase clients (browser/server/middleware) + typegen + session middleware
- [x] Task 12 — Google OAuth + `/login` + `/auth/callback` + `/pending`
- [x] Task 13 — Permission library (`can()`, `PermissionGate`) + unit tests
- [x] Task 14 — Site switcher (Zustand store + component)
- [x] Task 15 — AppShell (top bar + sidebar, `print:hide`)
- [x] Task 16 — `SearchableSelect` + tests
- [x] Task 17 — `DataGrid` (TanStack Table) + tests
- [x] Task 18 — CSV exporter + tests
- [x] Task 19 — XLSX exporter (frozen header, auto-filter) + tests
- [x] Task 20 — `ExportButton` + `PrintButton`
- [x] Task 21 — `EmptyState` + `ConfirmDialog` (reason-capturing)
- [x] Task 22 — `architecture.md` + `permissions.md` + this README
- [x] Task 23 — GitHub Actions CI (lint/typecheck/unit + rls + e2e)
- [x] Task 24 — Verification (see commit log)

**Foundation + Masters + Transactions (partial) all shipped:**

- [x] Foundation plan — 24/24 tasks
- [x] Masters plan — items · parties · sites · **locations** (simplified two-panel: templates + units; tree UI deferred)
- [x] Transactions (first pass) — **inward form**, **outward form** (4-field, grouped-destination), **unified transactions list** (search, IN/OUT filter, export, print)
- [ ] Transactions plan outstanding tasks (see `docs/superpowers/plans/2026-04-20-gei-inventory-transactions.md`): inline edit with audit, soft delete, item ledger, pivot view, golden-path e2e
- [ ] Phase 2 dashboard — live KPIs once transactions have real data

Two follow-up plans still to write and execute:

- `docs/superpowers/plans/2026-04-20-gei-inventory-masters.md` (items,
  parties, sites, locations screens)
- `docs/superpowers/plans/2026-04-20-gei-inventory-transactions.md` (inward,
  outward, transactions list, item ledger, inline edit, soft delete)

## Contributing

- Read the spec and plan before picking up a task.
- Follow TDD for any task labelled with a "Write the failing test" step.
- Every exported symbol in `lib/` gets a unit test.
- Every new RLS policy gets a test in `tests/rls/` asserting it for at
  least two roles (one allowed, one denied).
- Run `pnpm typecheck && pnpm lint && pnpm test` before opening a PR.
- Commit messages follow conventional style (`feat:`, `fix:`, `chore:`,
  `docs:`, `test:`). Keep them informative — reviewers rely on them.
- Branch from `main`. Open PRs into `main`. `main` is protected after
  Task 23 ships CI.

## Deployment target

- Frontend on Vercel.
- Backend on Supabase Cloud (separate project per environment).
- Runbook lands with Phase 3 under `docs/runbooks/deploy.md`.

## License

Proprietary — GEI internal.
