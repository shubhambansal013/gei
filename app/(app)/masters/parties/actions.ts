'use server';
import { runAction, withAuditReason } from '@/lib/actions/shared';
import { partyCreateSchema, partyUpdateSchema } from '@/lib/validators/party';
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/types';
import { revalidatePath } from 'next/cache';

export async function createParty(raw: unknown) {
  const res = await runAction(partyCreateSchema, raw, async (input, sb) => {
    // Cast to Supabase's Insert type which uses `string | null` for
    // optional nullable fields. Zod infers `string | null | undefined`
    // which conflicts with `exactOptionalPropertyTypes: true`.
    const row: TablesInsert<'parties'> = {
      name: input.name,
      type: input.type,
      gstin: input.gstin ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
    };
    const { data, error } = await sb.from('parties').insert(row).select().single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/masters/parties');
  return res;
}

export async function updateParty(raw: unknown) {
  const res = await runAction(partyUpdateSchema, raw, async ({ id, reason, ...rest }, sb) => {
    await withAuditReason(sb, reason!);
    // Same `exactOptionalPropertyTypes` workaround — map to explicit
    // Supabase Update type where all fields are `string | null`.
    const patch: TablesUpdate<'parties'> = {
      ...(rest.name !== undefined ? { name: rest.name } : {}),
      ...(rest.type !== undefined ? { type: rest.type } : {}),
      ...(rest.gstin !== undefined ? { gstin: rest.gstin ?? null } : {}),
      ...(rest.phone !== undefined ? { phone: rest.phone ?? null } : {}),
      ...(rest.address !== undefined ? { address: rest.address ?? null } : {}),
    };
    const { data, error } = await sb.from('parties').update(patch).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/masters/parties');
  return res;
}
