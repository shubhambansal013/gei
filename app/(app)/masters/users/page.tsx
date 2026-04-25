import { supabaseServer } from '@/lib/supabase/server';
import { UsersClient } from './users-client';

export const dynamic = 'force-dynamic';

/**
 * Admin user management. RLS gates every read and write:
 *   - `profiles_select_self_or_admin` returns non-SUPER_ADMIN users
 *     only their own row, so non-admins see a one-row table (themselves)
 *     and lose the grant controls.
 *   - `sua_*` policies restrict reads + writes to admins.
 */
export default async function UsersPage() {
  const sb = await supabaseServer();
  const [profilesRes, accessRes, sitesRes, rolesRes, overridesRes] = await Promise.all([
    sb
      .from('profiles')
      .select('id, full_name, phone, role_id, is_active, created_at')
      .order('created_at', { ascending: false }),
    sb
      .from('site_user_access')
      .select('id, user_id, site_id, role_id, granted_at, site:sites(id, code, name)')
      .order('granted_at', { ascending: false }),
    sb.from('sites').select('id, code, name').order('code'),
    sb.from('roles').select('id, label, level').order('level'),
    sb
      .from('site_user_permission_overrides')
      .select('id, access_id, module_id, action_id, granted'),
  ]);

  if (profilesRes.error) console.error('[UsersPage] profiles error:', profilesRes.error);
  if (accessRes.error) console.error('[UsersPage] access error:', accessRes.error);
  if (sitesRes.error) console.error('[UsersPage] sites error:', sitesRes.error);
  if (rolesRes.error) console.error('[UsersPage] roles error:', rolesRes.error);
  if (overridesRes.error) console.error('[UsersPage] overrides error:', overridesRes.error);

  return (
    <UsersClient
      profiles={profilesRes.data ?? []}
      access={accessRes.data ?? []}
      sites={sitesRes.data ?? []}
      roles={rolesRes.data ?? []}
      overrides={overridesRes.data ?? []}
    />
  );
}
