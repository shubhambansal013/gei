# GEI — Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the inventory recording loop — inward forms, outward forms, a unified transactions list, item ledgers, inline edit with audit, soft delete, and the destination × item pivot.

**Architecture:** Client-side forms in `app/(app)/inventory/*` call server actions that route through `runAction()` for Zod validation and RLS-aware Supabase writes. The audit trigger on `purchases` and `issues` captures every UPDATE; `SET LOCAL app.edit_reason` carries the reason. No new dependencies.

**Precondition:** Foundation plan landed and Masters plan tasks 1–5 done. Items / parties / sites / locations must be populated before workers can record transactions.

**State at plan-authoring time (already shipped on `feature/foundation`):**

- `lib/validators/purchase.ts` — `purchaseCreateSchema`
- `lib/validators/issue.ts` — `issueCreateSchema` as a discriminated union over destination kind
- `app/(app)/inventory/inward/new/` — functional simple-mode form + detailed toggle + server action
- `app/(app)/inventory/outward/new/` — 4-field form with combined destination dropdown + server action
- `app/(app)/inventory/transactions/` — unified list with search, IN/OUT filter, export, print, empty state

What remains: inline edit (with reason capture wired to the audit trigger), soft delete (same pattern), item ledger, pivot view, and the focused test suite.

---

## Tasks

### Task 1: Inline edit on transactions list

**Files:**

- Modify: `app/(app)/inventory/transactions/transactions-client.tsx`
- Create: `app/(app)/inventory/transactions/actions.ts`
- Create: `lib/validators/purchase-edit.ts`, `lib/validators/issue-edit.ts`
- Create: `tests/app/purchase-edit-validator.test.ts`, `tests/app/issue-edit-validator.test.ts`

- [ ] **Step 1: Edit validators**

Create `lib/validators/purchase-edit.ts`:

```ts
import { z } from 'zod';
export const purchaseEditSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(1, 'A reason is required for every edit'),
  received_qty: z.coerce.number().positive().optional(),
  rate: z.coerce.number().nonnegative().nullable().optional(),
  invoice_no: z.string().max(40).nullable().optional(),
  remarks: z.string().max(500).nullable().optional(),
});
export type PurchaseEdit = z.infer<typeof purchaseEditSchema>;
```

Create `lib/validators/issue-edit.ts` with `{ id, reason, qty?, issued_to?, remarks?, rate? }`.

- [ ] **Step 2: Server actions at `app/(app)/inventory/transactions/actions.ts`**

```ts
'use server';
import { runAction, withAuditReason } from '@/lib/actions/shared';
import { purchaseEditSchema } from '@/lib/validators/purchase-edit';
import { issueEditSchema } from '@/lib/validators/issue-edit';
import { revalidatePath } from 'next/cache';

export async function editPurchase(raw: unknown) {
  const res = await runAction(purchaseEditSchema, raw, async ({ id, reason, ...rest }, sb) => {
    await withAuditReason(sb, reason);
    const { data, error } = await sb.from('purchases').update(rest).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/inventory/transactions');
  return res;
}

// editIssue follows the same shape.
```

- [ ] **Step 3: Row-level edit UI**

On double-click of an editable cell, show a popover form: two fields (the editable column + a required reason). Only users with `INVENTORY.EDIT` see it — wrap in `<PermissionGate siteId={row.site_id} module="INVENTORY" action="EDIT">`.

- [ ] **Step 4: Integration test**

`tests/rls/audit-edit.test.ts`:

1. Insert a purchase via service role.
2. `signInAsUser('admin@test.local')` → set SUPER_ADMIN.
3. Call `editPurchase({ id, reason: 'qty correction', received_qty: 15 })`.
4. Query `inventory_edit_log` — expect one row with `reason = 'qty correction'`, `before_data->>received_qty = '10'`, `after_data->>received_qty = '15'`.

- [ ] **Step 5: Commit**

`feat(txns): inline edit on transactions list with audit-logged reason`

---

### Task 2: Soft delete on transactions list

**Files:**

- Modify: `app/(app)/inventory/transactions/actions.ts` (add `softDeletePurchase`, `softDeleteIssue`)
- Modify: `transactions-client.tsx` (row action menu)
- Create: `tests/rls/soft-delete.test.ts`

- [ ] **Step 1: Actions**

```ts
export async function softDeletePurchase(raw: { id: string; reason: string }) {
  return runAction(
    z.object({ id: z.string().uuid(), reason: z.string().min(1) }),
    raw,
    async ({ id, reason }, sb) => {
      await withAuditReason(sb, reason);
      const {
        data: { user },
      } = await sb.auth.getUser();
      const { error } = await sb
        .from('purchases')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
          delete_reason: reason,
        })
        .eq('id', id);
      if (error) throw new Error(error.message);
      return { id };
    },
  );
}
```

- [ ] **Step 2: Row menu**

`components/ui/dropdown-menu` → a "Delete" item that opens `<ConfirmDialog requireReason destructive>`. On confirm, calls `softDeletePurchase` / `softDeleteIssue`.

- [ ] **Step 3: RLS test — hard DELETE still blocked**

Even with `soft-delete`, the `purchases_no_delete` / `issues_no_delete` policies must keep returning 0 rows for a direct `.delete()`. Assert this in `tests/rls/soft-delete.test.ts`.

- [ ] **Step 4: Commit**

`feat(txns): soft-delete with reason + audit trigger, no hard DELETE allowed`

---

### Task 3: Item ledger

**Files:**

- Create: `app/(app)/inventory/item/[id]/page.tsx`, `item-ledger-client.tsx`

- [ ] **Step 1: Server component**

Fetch the item, all its purchases + issues (order by date asc), compute a running balance column client-side.

- [ ] **Step 2: Client component**

`<DataGrid>` with columns `Date · Type · Qty-In · Qty-Out · Balance · Party/Location · Rate · Remarks`. Running balance is `Σ in − Σ out` at each row. Print-friendly.

- [ ] **Step 3: Link from transactions list**

Item name cell in transactions list becomes a link to `/inventory/item/{item_id}`.

- [ ] **Step 4: Commit**

`feat(txns): item ledger with running balance + print-friendly layout`

---

### Task 4: Destination × Item pivot view

**Files:**

- Create: `supabase/migrations/20260420000006_pivot_view.sql` — a helper SQL view
- Create: `app/(app)/inventory/pivot/page.tsx`, `pivot-client.tsx`

- [ ] **Step 1: Backing view**

```sql
CREATE VIEW destination_item_pivot AS
SELECT
  i.site_id,
  COALESCE(lr.full_code, p.name, 's:' || ds.code) AS destination,
  COALESCE(lr.full_path, p.name, 'Site: ' || ds.name) AS destination_label,
  i.item_id,
  SUM(i.qty) AS total_qty
FROM issues i
LEFT JOIN location_references lr ON lr.id = i.location_ref_id
LEFT JOIN parties p ON p.id = i.party_id
LEFT JOIN sites ds ON ds.id = i.dest_site_id
WHERE i.is_deleted = false
GROUP BY i.site_id, destination, destination_label, i.item_id;
```

- [ ] **Step 2: Pivot rendering**

Fetch the rows, unfold into a matrix in the client (memoized). Rows are destinations, columns are items, cells are `total_qty`. Totals row at bottom, totals column on the right.

- [ ] **Step 3: Date range filter**

Add a `CREATE VIEW` variant that accepts `p_from`, `p_to` as a function, OR keep the view simple and apply the filter server-side by querying `issues` directly (simpler — skip the view).

- [ ] **Step 4: Commit**

`feat(txns): destination × item pivot with totals and date-range filter`

---

### Task 5: Golden-path e2e

**Files:**

- Modify: `tests/e2e/smoke.spec.ts` or create `tests/e2e/transaction-flow.spec.ts`

- [ ] **Step 1: Scenario**

1. Sign in as SUPER_ADMIN.
2. Create an item, a supplier, a site.
3. Record an inward (qty 100).
4. Record an outward (qty 20) to a location.
5. Assert transactions list shows both rows with correct qty / party / destination.
6. Assert the item ledger's running balance is 80.

- [ ] **Step 2: Commit**

`test(e2e): golden-path inward → outward → ledger-balance check`

---

### Task 6: Verification + docs

- [ ] Full check: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:rls && pnpm build && pnpm e2e`.
- [ ] Update README's "Current state" section: Transactions plan complete; Phase 2 dashboard is next.
- [ ] Update `docs/architecture.md` file layout to mention `app/(app)/inventory/*`.
- [ ] Commit: `docs(txns): reflect shipped transaction surface`.

---

## Self-review

**Coverage trace against the spec (§7.4–7.8):**

- Inward entry (simple + detailed) → shipped pre-plan, live on `/inventory/inward/new`
- Outward entry (4 fields, discriminated destination) → shipped, live on `/inventory/outward/new`
- Transactions list (unified, filters, export, print) → shipped, live on `/inventory/transactions`
- Item ledger → Task 3
- Pivot view → Task 4
- Inline edit (reason capture → audit trigger) → Task 1
- Soft delete → Task 2
- E2E golden paths → Task 5

**Risk:** Task 1's inline edit requires tight integration with the existing `TransactionsClient`. If that component has grown past ~300 lines, consider extracting the row-level edit affordance into `<RowEditPopover>` before wiring it up. Current size is ~200 lines; fine.

**What this plan does NOT cover:**

- Inward bulk-import CSV (future).
- Stock balance view at a point in time (backing `stock_balance` view exists; a dedicated screen is deferred to Phase 2 dashboard).
- The admin user-management UI (Phase 3 plan).
- Purchase orders, GRN, returns (out of scope for v1 per design spec §3).
