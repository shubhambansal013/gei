# GEI System — Design

**Status:** Approved for planning
**Date:** 2026-04-20
**Author:** Vivek Kumar, Head of Engineering

---

## 1. Problem statement

GEI runs construction sites where a small, non-technical workforce records
material inward (goods received from suppliers) and material outward (issued to
locations, contractors, or other sites). Today this happens in Excel, which is
error-prone, non-auditable, and does not support concurrent access or
role-based control. Workers entering data are not highly educated, so the
replacement must feel as close to Excel as possible for viewing while keeping
entry ruthlessly simple.

## 2. Goals

- Replace the current Excel-based inventory workflow for multiple sites.
- Excel-familiar VIEW (tables), guided-form ENTRY (low cognitive load).
- Multi-site from day one, scoped via role + per-site access.
- Auditable: every insert/update/soft-delete traceable to a user.
- Deploy and iterate fast; keep the stack mainstream and boring.

## 3. Non-goals (v1)

- Offline / PWA mode (decided: online-only for v1).
- Hindi or bilingual UI (decided: English only v1; `next-intl` wired so it is
  additive later).
- PDF export (browser print covers paper; server PDF is future).
- Purchase orders, requisitions, approvals workflow.
- GRN vs. invoice reconciliation; GST returns.
- Barcode / QR scanning for items.
- Mobile-native app (responsive web is enough; tablet-friendly).
- Notifications (email, WhatsApp, push).

---

## 4. Users and roles

Five roles, defined in your schema. Assignments happen at two levels:

1. **Global role** on `profiles.role_id` — defaults to `VIEWER` on sign-up.
2. **Per-site role** on `site_user_access.role_id` — what the user can do on
   that specific site.
3. **Per-permission override** on `site_user_permission_overrides` — narrows or
   widens individual module×action permissions for a user on a site.

Authoritative permission check is the existing `can_user(user_id, site_id,
module_id, action_id)` Postgres function. It is called from every RLS policy
and mirrored on the client only to show/hide UI (never for gating data).

| Role          | Global capability   | Typical user              |
| ------------- | ------------------- | ------------------------- |
| SUPER_ADMIN   | Everything          | GEI head office / devs    |
| ADMIN         | Everything on assigned sites | Regional manager     |
| STORE_MANAGER | Inventory RW + export on assigned sites | Site store keeper    |
| SITE_ENGINEER | DPR RW, Inventory R | Site engineer / foreman   |
| VIEWER        | Read-only           | Clients, auditors         |

The `DPR`, `LABOUR`, and `REPORTS` modules exist in the schema because they are
part of the broader GEI product roadmap. This initiative implements only
`INVENTORY` and `LOCATION` modules (plus admin screens for master data). The
RBAC infrastructure is generic — adding a new module later requires no schema
change, only new screens wired to new RLS policies.

---

## 5. Tech stack

| Layer               | Choice                                                    |
| ------------------- | --------------------------------------------------------- |
| Frontend framework  | Next.js 15 (App Router) + TypeScript (strict)             |
| Styling             | Tailwind CSS + shadcn/ui                                  |
| Data grids          | TanStack Table v8                                         |
| Forms               | React Hook Form + Zod                                     |
| Data fetching       | TanStack Query v5 + Supabase JS client                    |
| Backend / DB / Auth | Supabase (Postgres + RLS + Google OAuth)                  |
| Charts              | Recharts                                                  |
| Exports             | `exceljs` (XLSX) + native string writer (CSV)             |
| Print               | `@media print` CSS per view                               |
| i18n                | `next-intl` (English only v1, structure added early)      |
| Error tracking      | Sentry (frontend)                                         |
| Toasts              | `sonner`                                                  |
| Testing             | Vitest, React Testing Library, Playwright                 |
| Package manager     | pnpm                                                      |
| Pre-commit          | Husky + lint-staged (prettier, eslint, typecheck on diff) |
| Deploy              | Vercel (frontend) + Supabase Cloud (backend)              |

---

## 6. Schema additions

The canonical schema in `schema.sql` stays the source of truth. The following
additions are applied in-place as part of Phase 1.

### 6.1 `items.reorder_level`

```sql
ALTER TABLE items
  ADD COLUMN reorder_level NUMERIC CHECK (reorder_level IS NULL OR reorder_level >= 0);
```

Used by the dashboard low-stock widget. Null means "no alert configured".

### 6.2 `issues.rate`

```sql
ALTER TABLE issues
  ADD COLUMN rate NUMERIC CHECK (rate IS NULL OR rate >= 0);
```

Nullable. Clerks leave blank; managers may backfill for valuation. Outward
valuation falls back to weighted-average cost (`item_weighted_avg_cost` view)
when null.

### 6.3 `updated_at` + trigger on `purchases` and `issues`

```sql
ALTER TABLE purchases ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE issues    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_issues_updated_at
  BEFORE UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 6.4 `inventory_edit_log`

Captures every UPDATE on `purchases` and `issues`. Populated by DB triggers so
it cannot be bypassed by a malicious client.

```sql
CREATE TABLE inventory_edit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  TEXT NOT NULL CHECK (table_name IN ('purchases', 'issues')),
  row_id      UUID NOT NULL,
  changed_by  UUID REFERENCES profiles(id),
  changed_at  TIMESTAMPTZ DEFAULT now(),
  reason      TEXT,
  before_data JSONB NOT NULL,
  after_data  JSONB NOT NULL
);

CREATE INDEX idx_edit_log_table_row ON inventory_edit_log(table_name, row_id);
CREATE INDEX idx_edit_log_changed_at ON inventory_edit_log(changed_at DESC);

ALTER TABLE inventory_edit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "edit_log_select" ON inventory_edit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM purchases p
        WHERE p.id = row_id AND can_user(auth.uid(), p.site_id, 'INVENTORY', 'VIEW')
      UNION ALL
      SELECT 1 FROM issues i
        WHERE i.id = row_id AND can_user(auth.uid(), i.site_id, 'INVENTORY', 'VIEW')
    )
  );
```

The trigger function reads `auth.uid()` at write time and the `reason` is passed
via a session-level setting (`SET LOCAL app.edit_reason`) by the edge/API layer
before the UPDATE runs. Full trigger body is in the implementation plan.

### 6.5 Seed data

Seed scripts will live in `supabase/seed/` and cover: minimum one `location_template`,
reference enum rows (already in schema), and a single site for smoke testing.

---

## 7. Screens

Built in the order listed in §12 phasing.

### 7.1 Login (`/login`)

Single "Sign in with Google" button. Full-bleed brand background. Post-login
middleware routes:

- SUPER_ADMIN → `/dashboard`.
- User with at least one `site_user_access` row → `/dashboard` on their first
  accessible site.
- User with zero access → `/pending` screen ("Your account is awaiting admin
  approval").

### 7.2 App shell

Persistent sticky header with (left→right): site switcher, global search (`/`
to focus), user menu. Left sidebar for primary nav, collapsible on narrow
screens. All data-fetching functions accept the current `site_id` from a Zustand
store that is hydrated from the site switcher.

### 7.3 Dashboard (`/dashboard`)

KPI strip (top):

- Total stock value (₹) — `SUM(current_stock * wac)` per site.
- # SKUs with non-zero stock.
- Inward value, current month.
- Outward qty, current month.

Widgets:

- **Low-stock alerts** — items where `current_stock < reorder_level`; click row
  to open item ledger.
- **Top-10 consumption (last 30d)** — horizontal bar, clickable.
- **Recent transactions (last 10)** — mini-table, click row to open the full
  transaction.
- **Top-5 destinations by outward qty (last 30d)** — bar.

### 7.4 Inventory / Transactions (`/inventory/transactions`)

Unified paginated table of inward + outward. TanStack Table, 50 rows per page
default, selector for 25 / 50 / 100. Columns:

`#  Date  Type(chip)  Item  Qty  Unit  Party/Location  Issued-to/Invoice  By  Amount`

Filters (sticky bar above grid):

- Date range.
- Type (IN / OUT / both).
- Item — SearchableSelect.
- Party — SearchableSelect.
- Free-text search — matches item name/code, party name, invoice no, remarks.

Inline edit: gated on `INVENTORY.EDIT`. Double-click cell to enter edit mode.
Esc cancels. Blur commits with a confirm dialog that forces a `reason` string;
commit hits a server action that sets `SET LOCAL app.edit_reason = $reason`
before the UPDATE so the audit trigger captures it.

Soft-delete: same gating as edit; "Delete" action on row menu opens a dialog
that requires a `delete_reason`. Rows never leave the DB.

### 7.5 Inward entry (`/inventory/inward/new`)

Two-mode form; mode toggle persisted per user.

**Simple mode** (default, for clerks — 5 fields):

1. Item (SearchableSelect)
2. Qty (big numeric)
3. Unit (auto-filled from item, editable dropdown only if item allows multi-unit)
4. Supplier (SearchableSelect)
5. Invoice # (text)

Rate, received-unit, conversion factor, dates all default. `received_unit =
stock_unit`, `unit_conv_factor = 1`, `receipt_date = today`.

**Detailed mode** (managers): adds rate, received_unit vs stock_unit, conv
factor, HSN, invoice date, manufacturer, supplier part number, remarks. All
optional except what the schema already requires.

Submit → server action → insert into `purchases` → TanStack Query invalidates
`transactions`, `stock-balance`, `dashboard-kpis`. Toast on success. Optimistic
UI with rollback on error.

### 7.6 Outward entry (`/inventory/outward/new`)

The core low-effort screen. **Four fields:**

1. Item (SearchableSelect)
2. Qty (numeric)
3. Destination — a single combined SearchableSelect that groups its options:
   - **Locations** — `A-101 — Villa 6 / Floor 1 / Room 101` (resolved via
     `resolve_location()`). On first-use, the RPC creates the
     `location_references` row.
   - **Parties** — `ABC Contractors (CONTRACTOR)`.
   - **Sites** — `RGIPT-SIV (External site)` (for inter-site transfers).
     Internally maps to `dest_site_id`.
4. Issued to (free text, optional) — name of person who physically received.

Optional expandable "more" reveals: remarks, rate (managers only).

The destination field returns a discriminated union:

```ts
type Destination =
  | { kind: "location"; location_ref_id: string }
  | { kind: "party";    party_id: string }
  | { kind: "site";     dest_site_id: string };
```

Server action validates exactly one of the three is set (mirrors the
`chk_issue_destination` CHECK constraint) before inserting.

### 7.7 Item ledger (`/inventory/item/[id]`)

Per-item chronological ledger with running balance column. Columns:

`Date  Type  Qty-In  Qty-Out  Balance  Party/Location  Rate  Remarks`

Balance computed client-side from the ordered query result (cheap at item
scale). Print/export targets this exact view.

### 7.8 Pivot view (`/inventory/pivot`)

Destination × Item matrix. Rows = destinations (location refs + parties +
external sites), Columns = items. Cells = `SUM(qty)` over the selected date
range. Date range filter + item category filter above. Totals row at bottom,
totals column on the right. Export-ready.

### 7.9 Masters

- `/masters/items` — table + create/edit dialog. Fields per schema + `reorder_level`.
- `/masters/parties` — table + create/edit dialog.
- `/masters/sites` — table + create dialog.
- `/masters/locations` — per-site. Shows tree. Add template + add units + preview
  resolved path from a test code.
- `/masters/users` — SUPER_ADMIN + ADMIN only. Lists `profiles`; pick a user,
  assign global role; for each site, assign site role; open a per-permission
  override grid (modules × actions) to refine.

---

## 8. Reusable components

Every one of these ships with unit tests and a component-level README.

| Component           | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `SearchableSelect`  | cmdk-based typeahead. Generic `<T>`. Recent picks pinned on top. |
| `DataGrid`          | TanStack Table wrapper with Excel styling, keyboard nav, sticky. |
| `StatCard`          | KPI tile with label, value, trend arrow, optional sparkline.     |
| `DateRangeFilter`   | Start/end pickers with shortcuts (today, 7d, month, custom).     |
| `ExportButton`      | Dropdown → CSV / XLSX. Accepts `{ columns, rows, filename }`.    |
| `PrintButton`       | Applies `data-print` on `<html>` then `window.print()`.          |
| `PermissionGate`    | `<PermissionGate module="INVENTORY" action="EDIT">`. Hides UI.   |
| `AppShell`          | Top bar + sidebar + content slot.                                |
| `SiteSwitcher`      | Dropdown of user's sites. Writes to Zustand + URL.               |
| `ConfirmDialog`     | Used by edit commit, soft-delete. Requires reason string.        |
| `EmptyState`        | Standard empty/error/loading states for lists.                   |

---

## 9. Permissions model

- RLS on `purchases`, `issues`, `location_units`, `location_references`, plus new
  `inventory_edit_log`. Masters tables (`items`, `parties`, `sites`) are
  tenant-wide reference data — readable to any authenticated user, writable
  only by SUPER_ADMIN / ADMIN (new policies added in Phase 1).
- Every DB mutation goes through a Next.js server action that forwards the
  user's JWT to Supabase. No service-role key in the frontend.
- Client-side `can(module, action, siteId)` calls the same function via Supabase
  RPC on app load and caches per-site. Only used for UI visibility.
- Add RLS policies on masters:

```sql
-- items, parties, sites: SELECT for any authenticated user;
-- INSERT/UPDATE/DELETE only if user is SUPER_ADMIN or ADMIN on any site.
```

---

## 10. Export and print

- **CSV** — pure string writer. Columns passed by caller. UTF-8 with BOM so
  Excel on Windows opens correctly.
- **XLSX** — `exceljs`. Frozen header row, bold headers, auto-filter on header,
  auto-width columns, number-format on numeric cols, Indian currency format on
  amount cols (`₹#,##,##0.00`).
- **Print** — each view has its own `@media print` rules. Filters + nav hidden,
  table expands to full page, repeat header row across pages. Tested in
  Chrome, Firefox, Safari on macOS + Windows.

Button placement: top-right of every tabular view. Exports respect current
filters — what you see is what you export.

---

## 11. Testing

| Layer         | Tool                             | Coverage target                                                              |
| ------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| Unit          | Vitest                           | 90%+ lines on `lib/` — permissions, validators, exporters, stock math.       |
| Component     | RTL + Vitest                     | Every exported component in `components/` — render, keyboard, a11y, states.  |
| RLS / DB      | Vitest + Supabase local          | One suite per policy, one test per role level. Uses a seeded local DB.       |
| E2E           | Playwright                       | Golden paths only: (1) login → inward → stock up; (2) outward → stock down; (3) manager edits → audit log row; (4) export → XLSX downloadable; (5) print → print dialog opens. |

CI: GitHub Actions on every PR. Typecheck, lint, unit + component + RLS on all
PRs; E2E on PRs to `main` (Supabase local spin-up takes ~30s).

---

## 12. Documentation

- `README.md` (root) — prerequisites, local setup (`pnpm i`, Supabase CLI,
  env vars), running tests, deploy.
- `docs/architecture.md` — component diagram, data flow, why Next.js SSR, why
  RLS as source of truth.
- `docs/permissions.md` — role × module × action matrix; how overrides work;
  worked examples.
- `docs/schema.md` — generated from `schema.sql` + narrative around each table.
- `docs/runbooks/` — ops tasks: seed first SUPER_ADMIN, onboard a new site,
  rotate a compromised user, backfill rates, recover a soft-deleted txn.
- Per-module README inside `app/(app)/<module>/README.md` — what the screen
  does, its data contract, what its reusable components consume.
- JSDoc on every exported symbol in `components/` and `lib/`.

---

## 13. Observability and errors

- Sentry frontend; DSN via env.
- Supabase for DB/auth logs.
- `sonner` toasts; always surface the DB error message (don't lie with "failed").
- Optimistic updates in entry forms; rollback and toast on server reject.
- Error boundaries at route level.

---

## 14. Non-functional defaults

| Concern            | Default                                                  |
| ------------------ | -------------------------------------------------------- |
| Timezone           | `Asia/Kolkata`. Store UTC, render IST.                   |
| Date format        | `DD-MMM-YYYY` (e.g. `20-Apr-2026`)                       |
| Currency           | INR, lakh/crore grouping (`₹1,23,456.78`)                |
| Pagination         | 50 rows/page, options 25 / 50 / 100                      |
| Session            | 7 days (Supabase default)                                |
| Rate on issues     | Nullable; manager-only backfill                          |
| Browser support    | Latest 2 versions of Chrome, Edge, Firefox, Safari       |
| Min screen width   | 1024px for Excel-style grids; forms degrade gracefully to 375px |
| Accessibility      | WCAG 2.1 AA on entry forms and tables (keyboard + SR)    |

---

## 15. Phasing (proposed — finalized in implementation plan)

**Phase 1 — MVP ship:**
Auth + RBAC wiring + masters (items, parties, sites, locations) + inward form +
outward form + transactions list + item ledger + CSV + XLSX + browser print +
audit triggers + Playwright golden paths + README + deploy pipeline.

**Phase 2 — insight layer:**
Dashboard + pivot view + low-stock alerts + edit audit log UI.

**Phase 3 — admin polish:**
Inline edit UX polish + user management screen + per-permission overrides UI +
per-module READMEs + runbooks.

---

## 16. Open questions

None at design-approval time. Any discovered during implementation are raised
as PR questions or a new design-amendment doc under `docs/superpowers/specs/`.

---

## 17. Decision log

| # | Decision                                                  | When       |
| - | --------------------------------------------------------- | ---------- |
| 1 | Next.js 15 App Router + TS + Tailwind + shadcn/ui         | 2026-04-20 |
| 2 | Excel-look VIEW, form ENTRY, hybrid inline edit for managers | 2026-04-20 |
| 3 | Online-only v1                                            | 2026-04-20 |
| 4 | English only; first SUPER_ADMIN seeded via SQL            | 2026-04-20 |
| 5 | CSV + XLSX exports; browser print                         | 2026-04-20 |
| 6 | Dashboard widget set; `reorder_level` column added to `items` | 2026-04-20 |
