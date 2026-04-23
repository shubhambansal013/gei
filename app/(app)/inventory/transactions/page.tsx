import { supabaseServer } from '@/lib/supabase/server';
import { TransactionsClient } from './transactions-client';

export const dynamic = 'force-dynamic';

/**
 * Unified view of inward (purchases) + outward (issues). Fetched as
 * two parallel queries then merged client-side. RLS scopes the rows
 * to sites the current user has `INVENTORY.VIEW` on, so the browser
 * only ever sees what it's allowed to see.
 *
 * Soft-deleted rows are filtered out. Date bounds are unconstrained
 * by default; the client applies filters in-memory because the
 * volume is small enough (< 10k rows per site) and it keeps the
 * interaction instant.
 */
export default async function TransactionsPage() {
  const sb = await supabaseServer();

  const [{ data: purchases }, { data: issues }] = await Promise.all([
    sb
      .from('purchases')
      .select(
        `id, site_id, item_id, received_qty, stock_qty, rate, total_amount, receipt_date, invoice_no,
         item:items(id, code, name, stock_unit),
         vendor:parties(id, name)`,
      )
      .eq('is_deleted', false)
      .order('receipt_date', { ascending: false })
      .limit(500),
    sb
      .from('issues')
      .select(
        `id, site_id, item_id, qty, unit, issue_date, issued_to,
         item:items(id, code, name, stock_unit),
         party:parties(id, name),
         location:location_references(id, full_path, full_code),
         dest:sites!issues_dest_site_id_fkey(id, code, name)`,
      )
      .eq('is_deleted', false)
      .order('issue_date', { ascending: false })
      .limit(500),
  ]);

  return <TransactionsClient purchases={purchases ?? []} issues={issues ?? []} />;
}
