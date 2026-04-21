'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { runAction } from '@/lib/actions/shared';
import {
  permissionOverrideSchema,
  permissionOverrideDeleteSchema,
} from '@/lib/validators/permission-override';

const ROLE_IDS = ['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER', 'SITE_ENGINEER', 'VIEWER'] as const;
const roleEnum = z.enum(ROLE_IDS);

const updateRoleSchema = z.object({
  user_id: z.string().uuid(),
  role_id: roleEnum,
});

const grantAccessSchema = z.object({
  user_id: z.string().uuid(),
  site_id: z.string().uuid(),
  role_id: roleEnum,
});

const revokeAccessSchema = z.object({ access_id: z.string().uuid() });

const toggleActiveSchema = z.object({
  user_id: z.string().uuid(),
  is_active: z.boolean(),
});

/**
 * Admin user-management mutations. All four are gated on the admin-only
 * RLS policies on `profiles` + `site_user_access`: a VIEWER or
 * STORE_MANAGER calling these will get a policy-denied error back from
 * the DB. No app-layer check — RLS is the trust boundary.
 */
export async function updateUserRole(raw: unknown) {
  const res = await runAction(updateRoleSchema, raw, async ({ user_id, role_id }, sb) => {
    const { error } = await sb.from('profiles').update({ role_id }).eq('id', user_id);
    if (error) throw new Error(error.message);
    return { user_id, role_id };
  });
  if (res.ok) revalidatePath('/masters/users');
  return res;
}

export async function grantSiteAccess(raw: unknown) {
  const res = await runAction(grantAccessSchema, raw, async (input, sb) => {
    const {
      data: { user },
    } = await sb.auth.getUser();
    const { data, error } = await sb
      .from('site_user_access')
      .insert({ ...input, granted_by: user?.id ?? null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/masters/users');
  return res;
}

export async function revokeSiteAccess(raw: unknown) {
  const res = await runAction(revokeAccessSchema, raw, async ({ access_id }, sb) => {
    const { error } = await sb.from('site_user_access').delete().eq('id', access_id);
    if (error) throw new Error(error.message);
    return { access_id };
  });
  if (res.ok) revalidatePath('/masters/users');
  return res;
}

export async function toggleUserActive(raw: unknown) {
  const res = await runAction(toggleActiveSchema, raw, async ({ user_id, is_active }, sb) => {
    const { error } = await sb.from('profiles').update({ is_active }).eq('id', user_id);
    if (error) throw new Error(error.message);
    return { user_id, is_active };
  });
  if (res.ok) revalidatePath('/masters/users');
  return res;
}

/**
 * Upsert a per-permission override on a site_user_access row.
 * Composite uniqueness on (access_id, module_id, action_id) means
 * setting the same module×action flips the existing override rather
 * than duplicating it.
 */
export async function upsertPermissionOverride(raw: unknown) {
  const res = await runAction(permissionOverrideSchema, raw, async (input, sb) => {
    const { data, error } = await sb
      .from('site_user_permission_overrides')
      .upsert(input, { onConflict: 'access_id,module_id,action_id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/masters/users');
  return res;
}

export async function deletePermissionOverride(raw: unknown) {
  const res = await runAction(permissionOverrideDeleteSchema, raw, async ({ override_id }, sb) => {
    const { error } = await sb
      .from('site_user_permission_overrides')
      .delete()
      .eq('id', override_id);
    if (error) throw new Error(error.message);
    return { override_id };
  });
  if (res.ok) revalidatePath('/masters/users');
  return res;
}
