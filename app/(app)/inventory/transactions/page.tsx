export const runtime = "edge";
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

  const [{ data: purchases }, { data: issues }, { data: units }] = await Promise.all([
    sb
      .from('purchases')
      .select(
        `id, site_id, item_id, received_qty, received_unit, unit_conv_factor, stock_qty, rate, total_amount, receipt_date, invoice_no,
         item:items(id, code, name, stock_unit),
         vendor:parties(id, name)`,
      )
      .eq('is_deleted', false)
      .order('receipt_date', { ascending: false })
      .limit(500),
    sb
      .from('issues')
      .select(
        `id, site_id, item_id, qty, unit, issue_date, issued_to_legacy, worker_id,
         item:items(id, code, name, stock_unit),
         party:parties(id, name),
         location:location_units(id, name, code),
         dest:sites!issues_dest_site_id_fkey(id, code, name),
         worker:workers(id, code, full_name)`,
      )
      .eq('is_deleted', false)
      .order('issue_date', { ascending: false })
      .limit(500),
    sb.from('units').select('id, label, category').order('label'),
  ]);

  return (
    <TransactionsClient
      purchases={purchases ?? []}
      issues={issues ?? []}
      units={units ?? []}
    />
  );
}
