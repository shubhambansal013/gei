'use server';
import { z } from 'zod';
import { runAction } from '@/lib/actions/shared';
import type { TablesInsert } from '@/lib/supabase/types';
import { revalidatePath } from 'next/cache';

/**
 * Server action for saving the role-permissions matrix.
 *
 * The client sends the desired full state — a list of (role, module,
 * action) triples that should be present. The action diffs against
 * current rows and writes only the deltas:
 *   - rows in "desired" but not in "current" → INSERT
 *   - rows in "current" but not in "desired" → DELETE
 *
 * RLS (`role_permissions_write_super_admin`) guarantees only
 * SUPER_ADMIN can succeed here. We still do a server-side role-check
 * so a non-super-admin gets a clean error message instead of a
 * silent no-op from RLS returning zero rows.
 */

const cellSchema = z.object({
  role_id: z.string().min(1),
  module_id: z.string().min(1),
  action_id: z.string().min(1),
});

const payloadSchema = z.object({
  desired: z.array(cellSchema),
});

const keyOf = (c: z.infer<typeof cellSchema>) => `${c.role_id}|${c.module_id}|${c.action_id}`;

export async function saveRolePermissions(raw: unknown) {
  const res = await runAction(payloadSchema, raw, async (input, sb) => {
    // Authoritative SUPER_ADMIN check before we try to mutate.
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');
    const { data: profile, error: profileErr } = await sb
      .from('profiles')
      .select('role_id, is_active')
      .eq('id', auth.user.id)
      .single();
    if (profileErr) throw new Error(profileErr.message);
    if (!profile?.is_active || profile.role_id !== 'SUPER_ADMIN') {
      throw new Error('Only SUPER_ADMIN can edit role permissions');
    }

    const { data: current, error: curErr } = await sb
      .from('role_permissions')
      .select('role_id, module_id, action_id');
    if (curErr) throw new Error(curErr.message);

    const currentKeys = new Set((current ?? []).map(keyOf));
    const desiredKeys = new Set(input.desired.map(keyOf));

    const toInsert: TablesInsert<'role_permissions'>[] = input.desired.filter(
      (c) => !currentKeys.has(keyOf(c)),
    );
    const toDelete = (current ?? []).filter((c) => !desiredKeys.has(keyOf(c)));

    if (toInsert.length > 0) {
      const { error } = await sb.from('role_permissions').insert(toInsert);
      if (error) throw new Error(error.message);
    }

    // DELETEs have to be row-by-row because there is no natural
    // composite-key filter in PostgREST. The matrix is small
    // (5 roles × 5 modules × 5 actions = 125 cells max), so this is
    // effectively O(deltas) and never a hot path.
    for (const row of toDelete) {
      const { error } = await sb
        .from('role_permissions')
        .delete()
        .eq('role_id', row.role_id)
        .eq('module_id', row.module_id)
        .eq('action_id', row.action_id);
      if (error) throw new Error(error.message);
    }

    return { inserted: toInsert.length, deleted: toDelete.length };
  });

  if (res.ok) revalidatePath('/masters/role-permissions');
  return res;
}
