'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { runAction } from '@/lib/actions/shared';

/**
 * Signup-approval server actions.
 *
 * Authorization is enforced in two places:
 *   1. RLS — `profiles_update_self_or_admin` from 20260420000004
 *      ensures only admins (or the user themselves) can UPDATE a
 *      profile row. A non-admin caller gets SQLSTATE 42501 which
 *      `runAction` scrubs into "You do not have permission…".
 *   2. The UPDATE itself — `approved_by` is set to the caller's
 *      `auth.uid()`, so the audit trail always reflects the real
 *      actor, not a client-supplied value.
 *
 * `approveUser` flips `is_active` to `true` and stamps the approval
 * metadata. `deactivateUser` is the mirror: `is_active=false`,
 * clearing `approved_at` / `approved_by` so a re-approval is not
 * silently backdated.
 *
 * Both revalidate `/masters/users` so the admin list reflects the
 * change without a full refresh.
 */

const approveSchema = z.object({ user_id: z.string().uuid() });

export async function approveUser(raw: unknown) {
  const res = await runAction(approveSchema, raw, async ({ user_id }, sb) => {
    const {
      data: { user },
    } = await sb.auth.getUser();
    const { error } = await sb
      .from('profiles')
      .update({
        is_active: true,
        approved_at: new Date().toISOString(),
        approved_by: user?.id ?? null,
      })
      .eq('id', user_id);
    if (error) throw error;
    return { user_id };
  });
  if (res.ok) revalidatePath('/masters/users');
  return res;
}

export async function deactivateUser(raw: unknown) {
  const res = await runAction(approveSchema, raw, async ({ user_id }, sb) => {
    const { error } = await sb
      .from('profiles')
      .update({
        is_active: false,
        approved_at: null,
        approved_by: null,
      })
      .eq('id', user_id);
    if (error) throw error;
    return { user_id };
  });
  if (res.ok) revalidatePath('/masters/users');
  return res;
}
