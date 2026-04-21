import { supabaseServer } from '@/lib/supabase/server';
import { SitesClient } from './sites-client';

/**
 * /masters/sites — Sites master-data screen.
 *
 * Fetches all sites the current user can see (RLS enforces row-level
 * access) ordered by code, then delegates rendering to the client
 * component which wires up search, export, print, and create/edit
 * dialogs.
 */
export default async function SitesPage() {
  const sb = await supabaseServer();
  const { data: sites } = await sb.from('sites').select('*').order('code');

  return <SitesClient sites={sites ?? []} />;
}
