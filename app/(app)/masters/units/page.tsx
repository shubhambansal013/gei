export const runtime = "edge";
import { supabaseServer } from '@/lib/supabase/server';
import { UnitsClient } from './units-client';

/**
 * Admin screen for the `units` master. Fetches rows server-side under
 * the user's JWT — RLS will allow SELECT to any authenticated user and
 * restrict write buttons on the client via PermissionGate / server
 * action failure. No site scoping: units are tenant-wide.
 */
export default async function UnitsPage() {
  const sb = await supabaseServer();

  const { data, error } = await sb.from('units').select('*').order('id', { ascending: true });

  if (error) throw new Error(error.message);

  return <UnitsClient units={data ?? []} />;
}
