# Architecture

## Stack

- **Frontend:** Next.js 16 App Router, TypeScript strict, Tailwind v4 +
  shadcn/ui (`base-nova` style, backed by `@base-ui/react`)
- **Backend:** Supabase (Postgres + Auth + RLS). No custom API server.
- **Data grids:** TanStack Table v8
- **Forms:** React Hook Form + Zod
- **Data fetching:** TanStack Query v5 + Supabase JS
- **Exports:** `exceljs` (XLSX) + native string writer (CSV)
- **Print:** `@media print` CSS per view
- **Testing:** Vitest + RTL (unit + component, jsdom), Vitest + Supabase
  local (RLS policies, node env), Playwright (e2e)

## Request flow

```
Browser
  └─▶ Next.js middleware       (refreshes Supabase session cookie;
       │                        redirects unauthenticated traffic
       │                        to /login)
  └─▶ React Server Components  (read via supabaseServer())
  └─▶ Client Components        (read/write via supabaseBrowser())
           └─▶ Supabase Postgres
                 └─▶ RLS policy → can_user(user_id, site_id, module, action)
                 └─▶ DB trigger (inventory_edit_log) on UPDATE
```

No bespoke backend service. Every mutation rides the user's JWT all the
way to the database; the RLS policy is the only thing that decides
whether the row is touched.

## Why RLS as the trust boundary

- We own the DB; we do not own every client. A compromised frontend
  (devtools open, browser extension, etc.) must not be able to bypass
  authorization.
- A single Postgres function — `can_user(user_id, site_id, module, action)`
  — is called from every policy. Adding a new role or flipping a
  permission updates behavior everywhere at once.
- Frontend `can()` (in `lib/permissions/can.ts`) mirrors the same
  signature and is used **only** to hide UI that would fail anyway.

## Inventory surface

Shipped routes and their purpose:

- `/inventory/inward/new` — Receipt form for inbound material (4 fields: item, quantity, source, received-by)
- `/inventory/outward/new` — Issue form for outbound material (4 fields: item, quantity, destination, issued-to)
- `/inventory/transactions` — Unified transactions ledger with search, IN/OUT filter, CSV/XLSX export, browser print, and soft-delete row actions
- `/inventory/item/[id]` — Per-item ledger view showing all movements with running balance
- `/inventory/pivot` — Destination-by-item inventory matrix for at-a-glance distribution view

All forms feed into the `purchases` (inward) and `issues` (outward) tables. Every mutation is audited via the trigger pipeline.

## Audit flow

Every UPDATE on `purchases` and `issues` (inward/outward transactions) fires an AFTER trigger that:

1. Reads the session-local GUC `app.edit_reason` (set by the server action before the UPDATE)
2. Captures the before/after state as `to_jsonb(OLD/NEW)`
3. Inserts a row into `inventory_edit_log` with:
   - `table_name` (purchases or issues)
   - `row_id` (the transaction ID)
   - `changed_by` (the actor from `auth.uid()`)
   - `reason` (the GUC value, or NULL if unset)
   - `before_data`, `after_data` (full row snapshots)

Soft-deletes (setting `is_deleted = true`) flow through this same trigger. The reason is **always** required for both edits and soft-deletes to land in the log; a missing reason becomes NULL in the audit trail but the mutation still succeeds.

The trigger is non-bypassable: RLS policies prevent direct UPDATE to these tables, so all mutations go through server actions that set the GUC and run the UPDATE in a single transaction.

## File layout

See the approved design spec at
`docs/superpowers/specs/2026-04-20-gei-inventory-system-design.md` §5
for the full repo map. Key directories:

- `app/` — Next.js routes, grouped into `(auth)` and `(app)`
- `components/` — project-specific components + shadcn primitives
- `lib/supabase/` — browser / server / middleware clients + generated `types.ts`
- `lib/permissions/` — `createCan()` + types
- `lib/exporters/` — CSV + XLSX writers
- `lib/stores/` — Zustand stores (current site)
- `supabase/migrations/` — ordered SQL migrations (timestamp-prefixed)
- `tests/rls/` — live-DB RLS policy tests
- `tests/e2e/` — Playwright golden paths
- `docs/superpowers/` — specs and plans (dated)

## Build pipeline

- Pre-commit (Husky + lint-staged) runs `eslint --fix`, `prettier --write`,
  then `pnpm typecheck`. Nothing lands with a type error or lint warning.
- CI (`.github/workflows/ci.yml`) runs lint/typecheck/unit on every PR,
  RLS tests against a local Supabase spin-up, and Playwright e2e on PRs
  to `main`.

## Phases

- **Foundation (complete):** scaffolding, auth, RBAC, shared UI,
  exporters, audit triggers, CI.
- **Masters (complete):** items, parties, sites, locations screens
  with admin management UIs.
- **Transactions (90% complete):** inward + outward entry,
  transactions list, item ledger, inline edit (in progress), soft delete.
- **Phase 2 (dashboard):** KPI strip, low-stock alerts, top consumption,
  recent txns, destination pivot preview.
- **Phase 3 (admin polish):** user management UI, per-permission
  override UI, runbooks.
