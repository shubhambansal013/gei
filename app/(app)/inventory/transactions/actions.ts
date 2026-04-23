'use server';
import { revalidatePath } from 'next/cache';
import { runAction, withAuditReason } from '@/lib/actions/shared';
import { purchaseEditSchema, purchaseSoftDeleteSchema } from '@/lib/validators/purchase-edit';
import { issueEditSchema, issueSoftDeleteSchema } from '@/lib/validators/issue-edit';
import type { Database } from '@/lib/supabase/types';

type PurchaseUpdate = Database['public']['Tables']['purchases']['Update'];
type IssueUpdate = Database['public']['Tables']['issues']['Update'];

/**
 * Every mutation here:
 *   1. Validates via Zod (bail on bad input).
 *   2. Sets `app.edit_reason` on the current transaction via
 *      withAuditReason() → `SET LOCAL app.edit_reason = $reason`.
 *   3. Issues the UPDATE. The Postgres trigger
 *      `log_inventory_edit()` fires AFTER UPDATE and inserts the
 *      diff (old + new JSONB + reason + changed_by) into
 *      `inventory_edit_log`.
 *
 * RLS gates every write — `is_admin_anywhere` or site-scoped
 * `INVENTORY.EDIT` / `INVENTORY.DELETE` depending on the table.
 */

/**
 * Strip Zod-optional `undefined` values before sending to Supabase —
 * the generated types reject `undefined` under `exactOptionalPropertyTypes`
 * because each column is `string | null`, not `string | null | undefined`.
 */
function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

export async function editPurchase(raw: unknown) {
  const res = await runAction(purchaseEditSchema, raw, async ({ id, reason, ...rest }, sb) => {
    await withAuditReason(sb, reason);
    const payload = omitUndefined(rest) as PurchaseUpdate;
    const { data, error } = await sb
      .from('purchases')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/inventory/transactions');
  return res;
}

export async function editIssue(raw: unknown) {
  const res = await runAction(issueEditSchema, raw, async ({ id, reason, ...rest }, sb) => {
    await withAuditReason(sb, reason);
    const payload = omitUndefined(rest) as IssueUpdate;
    const { data, error } = await sb.from('issues').update(payload).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/inventory/transactions');
  return res;
}

export async function softDeletePurchase(raw: unknown) {
  const res = await runAction(purchaseSoftDeleteSchema, raw, async ({ id, reason }, sb) => {
    await withAuditReason(sb, reason);
    const {
      data: { user },
    } = await sb.auth.getUser();
    const { error } = await sb
      .from('purchases')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id ?? null,
        delete_reason: reason,
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
    return { id };
  });
  if (res.ok) {
    revalidatePath('/inventory/transactions');
    revalidatePath('/dashboard');
  }
  return res;
}

export async function softDeleteIssue(raw: unknown) {
  const res = await runAction(issueSoftDeleteSchema, raw, async ({ id, reason }, sb) => {
    await withAuditReason(sb, reason);
    const {
      data: { user },
    } = await sb.auth.getUser();
    const { error } = await sb
      .from('issues')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id ?? null,
        delete_reason: reason,
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
    return { id };
  });
  if (res.ok) {
    revalidatePath('/inventory/transactions');
    revalidatePath('/dashboard');
  }
  return res;
}
