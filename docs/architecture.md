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

## Audit log

Every UPDATE on `purchases` and `issues` fires an AFTER trigger that
inserts a row into `inventory_edit_log`:

```sql
INSERT INTO inventory_edit_log (
  table_name, row_id, changed_by, reason, before_data, after_data
)
VALUES (
  TG_TABLE_NAME, NEW.id, auth.uid(),
  NULLIF(current_setting('app.edit_reason', true), ''),
  to_jsonb(OLD), to_jsonb(NEW)
);
```

The reason flows in via a session-local GUC: the server action runs
`SET LOCAL app.edit_reason = $reason` in the same transaction before
its UPDATE. The trigger reads the setting with `missing_ok=true` so
unsetting works cleanly; an empty string becomes NULL. Capturing the
diff as `to_jsonb(OLD/NEW)` means schema evolution requires no trigger
edits — every column present at the time of the edit is preserved.

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

- **Foundation (this branch):** scaffolding, auth, RBAC, shared UI,
  exporters, audit triggers, CI.
- **Masters (next plan):** items, parties, sites, locations screens
  with admin management UIs.
- **Transactions (plan after masters):** inward + outward entry,
  transactions list, item ledger, inline edit, soft delete.
- **Phase 2 (dashboard):** KPI strip, low-stock alerts, top consumption,
  recent txns, destination pivot preview.
- **Phase 3 (admin polish):** user management UI, per-permission
  override UI, runbooks.
