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

  // Derive a representative site id from the user's accessible sites
  // for the PermissionGate check. Falls back to empty string — the
  // gate will resolve false, which is safe (VIEWER sees no create button).
  const siteId = sites?.[0]?.id ?? '';

  return <SitesClient sites={sites ?? []} siteId={siteId} />;
}
