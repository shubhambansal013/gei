export const runtime = "edge";
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
  const [
    { data: profiles },
    { data: access },
    { data: sites },
    { data: roles },
    { data: overrides },
  ] = await Promise.all([
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

  return (
    <UsersClient
      profiles={profiles ?? []}
      access={access ?? []}
      sites={sites ?? []}
      roles={roles ?? []}
      overrides={overrides ?? []}
    />
  );
}
