'use server';
import { runAction } from '@/lib/actions/shared';
import { unitCreateSchema, unitUpdateSchema } from '@/lib/validators/unit';
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/types';
import { revalidatePath } from 'next/cache';

/**
 * Server actions for the `units` master. Writes are RLS-gated to
 * admin-anywhere (see `20260423000008_units_admin_write.sql`). These
 * actions therefore do no extra role-check work: a non-admin's UPDATE
 * simply returns 0 rows and surfaces as an `ok: false` from runAction.
 *
 * `units` is pure reference data — no audit trigger, so we don't
 * forward a reason through `withAuditReason`. The schema still
 * requires a reason on updates as documentation for the operator.
 */

export async function createUnit(raw: unknown) {
  const res = await runAction(unitCreateSchema, raw, async (input, sb) => {
    const row: TablesInsert<'units'> = {
      id: input.id,
      label: input.label,
      category: input.category ?? null,
    };
    const { data, error } = await sb.from('units').insert(row).select().single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/masters/units');
  return res;
}

export async function updateUnit(raw: unknown) {
  const res = await runAction(unitUpdateSchema, raw, async (input, sb) => {
    const patch: TablesUpdate<'units'> = {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.category !== undefined ? { category: input.category ?? null } : {}),
    };
    const { data, error } = await sb
      .from('units')
      .update(patch)
      .eq('id', input.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/masters/units');
  return res;
}

/**
 * `units` is reference data — soft-delete is overkill when we can't
 * re-use an `id` anyway (FK from `items.unit` and `purchases.*_unit`).
 * Hard-delete surfaces any accidental removal through a FK violation,
 * which is the behaviour we want: if a unit is referenced, refuse.
 */
export async function deleteUnit(id: string) {
  const res = await runAction(unitCreateSchema.shape.id, id, async (validId, sb) => {
    const { error } = await sb.from('units').delete().eq('id', validId);
    if (error) throw new Error(error.message);
    return { id: validId };
  });
  if (res.ok) revalidatePath('/masters/units');
  return res;
}
