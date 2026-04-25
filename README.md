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

1. **Design spec** — `docs/archive/design-history/2026-04-20-gei-inventory-system-design.md`
2. **Foundation implementation plan** — `docs/archive/design-history/2026-04-20-gei-inventory-foundation.md`
3. **Database schema** — `schema.sql`
4. **AGENTS.md** — conventions for AI assistants working in this repo

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

Why these choices — see `docs/archive/design-history/…-design.md` §5.

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
> UPDATE profiles SET role_id = 'SUPER_ADMIN', is_active = true WHERE id = '<your-uid>';
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
| `pnpm db:diff`    | Generate a migration from schema drift   |

Husky pre-commit runs `lint-staged` + `typecheck` on every commit.

## Database schema workflow

Canonical schema lives in `schema.sql` at the repo root; ordered migrations
in `supabase/migrations/` are the executable shape applied to live
databases. Keeping the two aligned is semi-automated.

1. Edit `schema.sql` to reflect the desired end state.
2. Apply it to your local Supabase (destructive — dev only):
   `pnpm db:reset`.
3. Generate a migration from the drift between migrations and the
   current local DB: `pnpm db:diff --name add_foo_column`. This writes
   `supabase/migrations/<timestamp>_add_foo_column.sql`.
4. Inspect the generated SQL — `supabase db diff` is best-effort; edit
   it by hand when it misses policies, functions, or defaults.
5. Commit `schema.sql` and the new migration together.
6. On another machine: `supabase migration up` applies the delta
   without resetting the DB.

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
  archive/design-history/   Historical design docs and plans (dated)
  architecture.md           System overview (coming in Task 22)
  permissions.md            Role × module × action matrix (Task 22)
  runbooks/                 Ops runbooks (Phase 3)
.remember/                  Claude Code session memory — gitignored, do not edit
```

## Current state

**Shipped routes** — 14 routes live, every one of them backed by RLS:

| Route                     | Surface                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `/login`                  | Google OAuth + email/password fallback for local dev                                                               |
| `/pending`                | Awaiting-admin-approval landing for users with no site access                                                      |
| `/auth/callback`          | OAuth code exchange                                                                                                |
| `/dashboard`              | Live KPIs (inward value, SKUs, month totals), low-stock alerts, top-10 consumption bars, recent-10 txns            |
| `/masters/items`          | Items CRUD with reorder level + HSN + category                                                                     |
| `/masters/parties`        | Vendors / contractors / clients with GSTIN validation                                                              |
| `/masters/sites`          | Sites master; SELECT is RLS-scoped to accessible sites                                                             |
| `/masters/locations`      | Templates (nodes) + Units panels                                                                                   |
| `/masters/users`          | Admin user management: global role, per-site access grants, activate/deactivate                                    |
| `/inventory/inward/new`   | Goods-received form — simple 5-field mode + detailed toggle                                                        |
| `/inventory/outward/new`  | Issue form — 4 fields, one grouped destination dropdown                                                            |
| `/inventory/transactions` | Unified ledger: search, IN/OUT filter, inline edit + soft-delete with audit reason, CSV/XLSX export, browser print |
| `/inventory/item/[id]`    | Per-item ledger with running balance + current stock headline                                                      |
| `/inventory/pivot`        | Destination × item matrix with date-range filter + totals                                                          |

**Plans** — Foundation 24/24 ✓ · Masters 5/5 ✓ · Transactions 5/6 ✓ (golden-path e2e deferred) · Phase 2 dashboard ✓ · Phase 3 user-management ✓.

**Deferred by design**:

- Full location tree editor (drag-reorder nodes) — we ship a flat node editor that's admin-friendly enough for the MVP
- Per-permission override UI — direct SQL via Supabase Studio for now; the overrides table is in the schema and honored by `can_user()`
- Hindi / bilingual UI — `next-intl` is wired but v1 ships English-only per spec
- PDF export — browser print covers paper output

See `docs/runbooks/deploy.md` for shipping to production.

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

- Frontend on Cloudflare Workers (via `@opennextjs/cloudflare`).
- Backend on Supabase Cloud (separate project per environment).
- Runbook lands with Phase 3 under `docs/runbooks/deploy.md`.

## License

Proprietary — GEI internal.
