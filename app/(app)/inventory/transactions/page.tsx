import { supabaseServer } from '@/lib/supabase/server';
import { TransactionsClient, type PurchaseRow, type IssueRow } from './transactions-client';
import { type WorkerOption } from '@/components/worker-picker';

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

  const [{ data: purchases }, { data: issues }, { data: units }, { data: workers }] =
    await Promise.all([
      sb
        .from('purchases')
        .select(
          `id, site_id, item_id, received_qty, received_unit, unit_conv_factor, stock_qty, rate, total_amount, receipt_date, invoice_no,
         item:items(id, code, name, stock_unit),
         vendor:parties(id, name)`,
        )
        .eq('is_deleted', false)
        .order('receipt_date', { ascending: false })
        .limit(1000),
      sb
        .from('issues')
        .select(
          `id, site_id, item_id, qty, unit, issue_date, worker_id,
         item:items(id, code, name, stock_unit),
         party:parties(id, name),
         location:location_units(id, name, code),
         dest:sites!issues_dest_site_id_fkey(id, code, name),
         worker:workers(id, code, full_name)`,
        )
        .eq('is_deleted', false)
        .order('issue_date', { ascending: false })
        .limit(1000),
      sb.from('units').select('id, label, category').order('label'),
      sb
        .from('workers')
        .select(
          `
        id, code, full_name, current_site_id,
        worker_affiliations(
          employment_type,
          contractor:parties!worker_affiliations_contractor_party_id_fkey(name)
        )
        `,
        )
        .order('full_name'),
    ]);

  return (
    <TransactionsClient
      purchases={(purchases as unknown as PurchaseRow[]) ?? []}
      issues={(issues as unknown as IssueRow[]) ?? []}
      units={units ?? []}
      workers={(workers as unknown as WorkerOption[]) ?? []}
    />
  );
}
