import { supabaseServer } from '@/lib/supabase/server';
import { PivotClient } from './pivot-client';

export const dynamic = 'force-dynamic';

/**
 * Destination × Item pivot. Fetches raw issues (with related item,
 * party, location, and dest-site rows) and aggregates client-side
 * into a matrix. Client-side is fine until the per-site issue volume
 * exceeds ~10k rows; a dedicated SQL view (`destination_item_pivot`)
 * is sketched in the Transactions plan for that upgrade.
 */
export default async function PivotPage() {
  const sb = await supabaseServer();
  const { data: issues } = await sb
    .from('issues')
    .select(
      `id, site_id, qty, issue_date,
       item:items(id, code, name, stock_unit),
       party:parties(id, name, short_code),
       location:location_units(id, name, code),
       dest:sites!issues_dest_site_id_fkey(id, code, name)`,
    )
    .eq('is_deleted', false)
    .limit(5000);

  return <PivotClient issues={issues ?? []} />;
}
