# GEI — Masters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the admin-facing master-data screens (items, parties, sites, locations) so operators can populate reference data before any transaction can be recorded.

**Architecture:** Next.js App Router pages under `app/(app)/masters/` compose `DataGrid` + `ConfirmDialog` + RHF/Zod forms. All mutations go through Next.js server actions using `supabaseServer()`; RLS (Tasks 9 + `is_admin_anywhere()`) enforces that only SUPER_ADMIN / ADMIN roles can write. Location template → unit → reference hierarchy is covered in its own task because of its depth; everything else is a flat CRUD.

**Tech Stack:** Same as Foundation. No new dependencies.

**Precondition:** `feature/foundation` is merged into `main`, or this plan's branch is cut from `feature/foundation` directly.

**Sibling plan (comes after this one):** `2026-04-20-gei-inventory-transactions.md`

---

## File structure produced by this plan

```
app/(app)/masters/
  layout.tsx                    # shared tabs: Items | Parties | Sites | Locations | Users
  items/
    page.tsx                    # list + search + create/edit dialog
    actions.ts                  # server actions: createItem, updateItem
  parties/
    page.tsx
    actions.ts
  sites/
    page.tsx
    actions.ts
  locations/
    page.tsx                    # tree view + add-template, add-unit
    actions.ts                  # resolveLocation RPC, createUnit, createTemplate
  users/                        # deferred to Phase 3 plan; skeleton only here

lib/
  actions/shared.ts             # withAuditReason(), wrapServerAction() helpers
  validators/
    item.ts
    party.ts
    site.ts
    location.ts

components/
  master-shell.tsx              # table + toolbar (search + export + "+ New" button)
  forms/
    item-form.tsx
    party-form.tsx
    site-form.tsx

tests/
  rls/
    masters.test.ts             # extend existing file with per-role cases
  app/
    master-actions.test.ts      # unit-test the server actions (mock Supabase)
```

---

## Task 1: Shared master scaffolding

**Files:**

- Create: `app/(app)/masters/layout.tsx`, `components/master-shell.tsx`, `lib/actions/shared.ts`, `lib/validators/item.ts`

- [ ] **Step 1: `app/(app)/masters/layout.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/masters/items', label: 'Items' },
  { href: '/masters/parties', label: 'Parties' },
  { href: '/masters/sites', label: 'Sites' },
  { href: '/masters/locations', label: 'Locations' },
];

export default function MastersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Masters</h1>
      <nav className="flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'border-b-2 px-3 py-2 text-sm',
              pathname?.startsWith(t.href)
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-600 hover:text-gray-900',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div>{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: `components/master-shell.tsx`**

```tsx
'use client';
import { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ExportButton } from '@/components/export-button';
import { PrintButton } from '@/components/print-button';

type Col<T> = { key: keyof T; header: string; numFmt?: string };

type Props<T> = {
  title: string;
  search: string;
  onSearch: (s: string) => void;
  onNew: () => void;
  canCreate: boolean;
  exportFile: string;
  exportCols: Col<T>[];
  exportRows: T[];
  children: ReactNode;
};

export function MasterShell<T>({
  title,
  search,
  onSearch,
  onNew,
  canCreate,
  exportFile,
  exportCols,
  exportRows,
  children,
}: Props<T>) {
  return (
    <section>
      <div className="print:hide mb-3 flex items-center justify-between gap-2">
        <Input
          placeholder={`Search ${title}...`}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2">
          <ExportButton filename={exportFile} columns={exportCols} rows={exportRows} />
          <PrintButton />
          {canCreate && (
            <Button onClick={onNew} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              New
            </Button>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}
```

- [ ] **Step 3: `lib/actions/shared.ts`**

```ts
import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Wraps a server action body: resolves the Supabase server client,
 * validates the input with Zod, and normalizes errors into
 * `ActionResult`. Client components consume `{ok, data | error}`.
 */
export async function runAction<I, O>(
  schema: z.ZodType<I>,
  raw: unknown,
  body: (input: I, sb: Awaited<ReturnType<typeof supabaseServer>>) => Promise<O>,
): Promise<ActionResult<O>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  try {
    const sb = await supabaseServer();
    const data = await body(parsed.data, sb);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Sets `app.edit_reason` on the current transaction so the audit
 * trigger captures the reason. Call immediately before an UPDATE.
 */
export async function withAuditReason(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  reason: string,
) {
  await sb.rpc('set_config' as never, {
    name: 'app.edit_reason',
    value: reason,
    is_local: true,
  });
}
```

- [ ] **Step 4: `lib/validators/item.ts`**

```ts
import { z } from 'zod';

export const itemCreateSchema = z.object({
  name: z.string().min(1).max(120),
  code: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[A-Z0-9_-]+$/i),
  category_id: z.string().nullable().optional(),
  unit: z.string().min(1),
  hsn_code: z.string().max(20).nullable().optional(),
  reorder_level: z.coerce.number().nonnegative().nullable().optional(),
});

export const itemUpdateSchema = itemCreateSchema.partial().extend({
  id: z.string().uuid(),
  reason: z.string().min(1),
});

export type ItemCreate = z.infer<typeof itemCreateSchema>;
export type ItemUpdate = z.infer<typeof itemUpdateSchema>;
```

- [ ] **Step 5: Commit**

```
feat(masters): scaffold layout, MasterShell, action helpers, item validator

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Task 2: Items master screen

**Files:**

- Create: `app/(app)/masters/items/page.tsx`, `app/(app)/masters/items/actions.ts`, `components/forms/item-form.tsx`, `tests/app/master-actions.test.ts`

- [ ] **Step 1: Failing test at `tests/app/master-actions.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { itemCreateSchema } from '@/lib/validators/item';

describe('itemCreateSchema', () => {
  it('accepts a minimal valid item', () => {
    const r = itemCreateSchema.safeParse({ name: 'Cement OPC 53', code: 'CEM-53', unit: 'MT' });
    expect(r.success).toBe(true);
  });
  it('rejects invalid code characters', () => {
    const r = itemCreateSchema.safeParse({ name: 'X', code: 'has space', unit: 'NOS' });
    expect(r.success).toBe(false);
  });
  it('rejects missing unit', () => {
    const r = itemCreateSchema.safeParse({ name: 'X', code: 'X1' });
    expect(r.success).toBe(false);
  });
  it('coerces numeric reorder_level', () => {
    const r = itemCreateSchema.safeParse({
      name: 'X',
      code: 'X1',
      unit: 'NOS',
      reorder_level: '10',
    });
    expect(r.success && r.data.reorder_level).toBe(10);
  });
});
```

- [ ] **Step 2: Run — verify fail**

`pnpm test master-actions` → FAIL (import fails because validators/item.ts doesn't exist yet). If Task 1 landed first, these pass immediately — that's also acceptable since we test the _schema_ not the action here.

- [ ] **Step 3: Server actions at `app/(app)/masters/items/actions.ts`**

```ts
'use server';
import { runAction, withAuditReason } from '@/lib/actions/shared';
import { itemCreateSchema, itemUpdateSchema } from '@/lib/validators/item';
import { revalidatePath } from 'next/cache';

export async function createItem(raw: unknown) {
  const res = await runAction(itemCreateSchema, raw, async (input, sb) => {
    const { data, error } = await sb.from('items').insert(input).select().single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/masters/items');
  return res;
}

export async function updateItem(raw: unknown) {
  const res = await runAction(itemUpdateSchema, raw, async ({ id, reason, ...rest }, sb) => {
    await withAuditReason(sb, reason);
    const { data, error } = await sb.from('items').update(rest).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/masters/items');
  return res;
}
```

- [ ] **Step 4: Form at `components/forms/item-form.tsx`**

Render: `name`, `code`, `unit` (SearchableSelect against the 15 `units` rows), `category_id` (SearchableSelect against `item_categories`), `hsn_code`, `reorder_level`. On submit, call the appropriate server action and display `ok`/`error` toast via `sonner`.

(Full code: compose with RHF + zodResolver; ~120 lines. Pattern: identical to any shadcn form example, with `SearchableSelect` wrapping the Controller.)

- [ ] **Step 5: Page at `app/(app)/masters/items/page.tsx`**

Server Component that fetches `items` + `units` + `item_categories` via `supabaseServer()`. Renders `<MasterShell>` with a `DataGrid` of columns [code, name, unit, category, reorder_level]. `+ New` opens `ItemFormDialog` wired to `createItem`. Row-click opens the same dialog in edit mode wired to `updateItem` (reason capture required).

Wrap the "+ New" and "Edit" affordances in `<PermissionGate module="INVENTORY" action="CREATE">` / `EDIT` — though items RLS is SUPER_ADMIN-only anyway, the UI hint is still informative.

- [ ] **Step 6: Run all tests + typecheck + lint + build**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

- [ ] **Step 7: Commit**

```
feat(masters): items CRUD screen + server actions + form

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Task 3: Parties master screen

Mirrors Task 2 exactly — `/masters/parties`, `party-form.tsx`, actions, `party.ts` validator. Same file shape, same test pattern. `party_types` dropdown is loaded the same way as `item_categories`.

- [ ] **Files:** `app/(app)/masters/parties/page.tsx`, `actions.ts`, `components/forms/party-form.tsx`, `lib/validators/party.ts`
- [ ] **Validator:** `name` (required, 1..120), `type` (one of party_types ids), `gstin`, `phone`, `address` all optional strings.
- [ ] **Columns in grid:** name, type (label, not id), gstin, phone.
- [ ] **Tests:** three schema-validity tests + one type-must-exist test.
- [ ] **Commit:** `feat(masters): parties CRUD screen + actions + form`

---

## Task 4: Sites master screen

Mirrors Task 2, with two differences:

- Grid columns: code, name, type, address.
- Only SUPER_ADMIN or ADMIN-anywhere can see a site row, per `sites_select_accessible` policy. VIEWER sees no rows — the empty state prompts them to contact an admin.

- [ ] **Files:** `app/(app)/masters/sites/page.tsx`, `actions.ts`, `components/forms/site-form.tsx`, `lib/validators/site.ts`
- [ ] **Validator:** `code` (unique, uppercase+numeric+dash, 1..20), `name` (1..120), `type` optional enum (hostel, office, residential, …), `address` optional.
- [ ] **Tests:** schema tests + one `create site → new row visible to SUPER_ADMIN → not visible to VIEWER with no access row` RLS test.
- [ ] **Commit:** `feat(masters): sites CRUD screen + actions + form`

---

## Task 5: Locations master screen

The complex one. Separate templates, units, and references into three panels:

- [ ] **Templates panel** — table of `location_templates` with an "Edit Nodes" drill-down. Node editor is a tree (Base UI `Tree` component or custom): add child node (name + code + type), drag to reorder, delete (cascade warning). Nodes have `(parent_id, code)` unique constraint; surface friendly errors on collision.

- [ ] **Units panel** — per-site list of `location_units`. "+ New Unit" dialog picks a template (optional), fills name + code + type. Seeding helper: "Create N units from template" generates `Block 1..N`.

- [ ] **References panel (read-only for Phase 1)** — lists `location_references` with `full_path` and `full_code`. Shows they auto-populate on first use via the `resolve_location()` RPC; no direct create.

- [ ] **Validators:** `locationTemplateSchema`, `locationTemplateNodeSchema` (with parent-code uniqueness), `locationUnitSchema`.
- [ ] **Tests:** two integration tests against local Supabase verifying `resolve_location('A-1-101')` returns the expected full_path.
- [ ] **Commit:** `feat(masters): locations (templates + units + references) screens`

This task is the largest in this plan. If the implementer feels scope pressure, split it into two commits: templates + nodes first, units second. References are read-only so they come free once the rows start landing.

---

## Task 6: Seed helper + bootstrap runbook

Add a SQL seed at `supabase/seed/0001_bootstrap.sql` with: one location template with typical hostel nodes, a few units, reference item categories (already seeded in base schema — skip), and a placeholder `sites` row. Also add a runbook at `docs/runbooks/bootstrap-first-site.md` that walks through: sign in as first user → make SUPER_ADMIN via SQL → create a site in `/masters/sites` → grant self `site_user_access` → pick the site in the switcher → start entering items / parties.

- [ ] **Files:** `supabase/seed/0001_bootstrap.sql`, `docs/runbooks/bootstrap-first-site.md`
- [ ] **Commit:** `feat(masters): seed bootstrap + first-site runbook`

---

## Task 7: RLS tests (extend existing)

Append to `tests/rls/masters.test.ts`:

- [ ] STORE_MANAGER on Site A cannot INSERT an item (items are admin-write only).
- [ ] ADMIN on Site A can INSERT an item.
- [ ] SUPER_ADMIN sees every site; VIEWER with access to site A sees only site A.
- [ ] `withAuditReason` + UPDATE on an item surfaces a row in `inventory_edit_log` with the reason captured — already tested for purchases/issues; add an items-update variant to catch drift if we ever extend the audit trigger to items.

- [ ] **Commit:** `test(rls): extend masters policy coverage with role matrix`

---

## Task 8: Verification + docs

- [ ] **Step 1:** `pnpm typecheck && pnpm lint && pnpm test && pnpm test:rls && pnpm build` — all green.
- [ ] **Step 2:** Update README "Current state" section: Masters screens shipped, Transactions next.
- [ ] **Step 3:** Update `docs/architecture.md` with a "Masters" paragraph under file layout.
- [ ] **Step 4:** Manual smoke: start dev server → sign in → get SUPER_ADMIN → create site → create item → create party → create location unit → confirm they appear in the dropdowns used by the (future) Transactions screens (check via Supabase Studio that rows landed).
- [ ] **Step 5:** Commit docs update: `docs(masters): reflect shipped screens`.

---

## Self-review notes

**Coverage trace against the spec (§7.9):**

- Items CRUD → Task 2 ✅
- Parties CRUD → Task 3 ✅
- Sites CRUD → Task 4 ✅
- Locations (templates + units + references) → Task 5 ✅
- User management (SUPER_ADMIN + ADMIN only) → deferred to Phase 3 plan (out of scope here)

**Placeholder scan:** Task 5 has one soft placeholder — the tree-editor component for template nodes is described structurally rather than with full code, because its complexity depends on whether we pick an off-the-shelf tree component or roll our own. The implementer picks one during Step 1 and writes it out; flag in the PR description.

**Type consistency:**

- `ActionResult<T>` defined in `lib/actions/shared.ts`; used by every `actions.ts` file.
- Validators export both the schema and the inferred TS type (`ItemCreate`, etc.) so forms and actions share shapes.
- All validator field names match the DB column names exactly.

**What this plan does NOT cover:**

- The user-management admin screen (Phase 3).
- Location-template seeding UI (post-Phase-1 polish).
- Bulk-import CSV upload for masters (future).
- Soft-delete of master rows (current design doesn't support it; masters are hard-deletable by admins).
