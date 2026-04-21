'use server';
import { runAction, withAuditReason } from '@/lib/actions/shared';
import { itemCreateSchema, itemUpdateSchema } from '@/lib/validators/item';
import type { Database } from '@/lib/supabase/types';
import { revalidatePath } from 'next/cache';

type ItemInsert = Database['public']['Tables']['items']['Insert'];
type ItemUpdate = Database['public']['Tables']['items']['Update'];

// Remove keys whose value is `undefined` so exactOptionalPropertyTypes
// does not conflict with Supabase's Insert/Update types.
// We cast to the Supabase Insert/Update type as a second step.
function toInsert<T extends object>(obj: T): ItemInsert {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as unknown as ItemInsert;
}

function toUpdate<T extends object>(obj: T): ItemUpdate {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as unknown as ItemUpdate;
}

export async function createItem(raw: unknown) {
  const res = await runAction(itemCreateSchema, raw, async (input, sb) => {
    const { data, error } = await sb.from('items').insert(toInsert(input)).select().single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/masters/items');
  return res;
}

export async function updateItem(raw: unknown) {
  const res = await runAction(itemUpdateSchema, raw, async ({ id, reason, ...rest }, sb) => {
    await withAuditReason(sb, reason!);
    const { data, error } = await sb
      .from('items')
      .update(toUpdate(rest))
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/masters/items');
  return res;
}
