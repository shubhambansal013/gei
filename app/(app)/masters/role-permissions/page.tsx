export const dynamic = "force-dynamic";

import { supabaseServer } from '@/lib/supabase/server';
import { RolePermissionsClient } from './rp-client';

/**
 * Role-permissions matrix editor. Loads the full RBAC catalog (roles,
 * modules, actions) plus the current `role_permissions` rows, and
 * hands them to the client. Writes are RLS-gated to SUPER_ADMIN.
 *
 * This is a tenant-wide settings screen — no site scoping. A change
 * here reshapes default permissions for every site, which is why the
 * write boundary is deliberately narrower than the other masters.
 */
export default async function RolePermissionsPage() {
  const sb = await supabaseServer();

  const [rolesRes, modulesRes, actionsRes, rpRes] = await Promise.all([
    sb.from('roles').select('id, label, level').order('level', { ascending: true }),
    sb.from('modules').select('id, label').order('label', { ascending: true }),
    sb.from('actions').select('id, label').order('id', { ascending: true }),
    sb.from('role_permissions').select('role_id, module_id, action_id'),
  ]);

  if (rolesRes.error) throw new Error(rolesRes.error.message);
  if (modulesRes.error) throw new Error(modulesRes.error.message);
  if (actionsRes.error) throw new Error(actionsRes.error.message);
  if (rpRes.error) throw new Error(rpRes.error.message);

  return (
    <RolePermissionsClient
      roles={rolesRes.data ?? []}
      modules={modulesRes.data ?? []}
      actions={actionsRes.data ?? []}
      rolePermissions={rpRes.data ?? []}
    />
  );
}
