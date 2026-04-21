'use server';
import { runAction, withAuditReason } from '@/lib/actions/shared';
import { siteCreateSchema, siteUpdateSchema } from '@/lib/validators/site';
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/types';
import { revalidatePath } from 'next/cache';

export async function createSite(raw: unknown) {
  const res = await runAction(siteCreateSchema, raw, async (input, sb) => {
    // Map to Supabase's Insert type — Zod infers `string | null | undefined`
    // for optional-nullable fields, which conflicts with `exactOptionalPropertyTypes`.
    const row: TablesInsert<'sites'> = {
      code: input.code,
      name: input.name,
      type: input.type ?? null,
      address: input.address ?? null,
    };
    const { data, error } = await sb.from('sites').insert(row).select().single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/masters/sites');
  return res;
}

export async function updateSite(raw: unknown) {
  const res = await runAction(siteUpdateSchema, raw, async ({ id, reason, ...rest }, sb) => {
    await withAuditReason(sb, reason!);
    // Same exactOptionalPropertyTypes workaround — spread only the
    // present fields, coercing nullable optional strings to null.
    const patch: TablesUpdate<'sites'> = {
      ...(rest.code !== undefined ? { code: rest.code } : {}),
      ...(rest.name !== undefined ? { name: rest.name } : {}),
      ...(rest.type !== undefined ? { type: rest.type ?? null } : {}),
      ...(rest.address !== undefined ? { address: rest.address ?? null } : {}),
    };
    const { data, error } = await sb.from('sites').update(patch).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/masters/sites');
  return res;
}
