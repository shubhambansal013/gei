export const runtime = "edge";
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { ItemLedgerClient } from './item-ledger-client';

export const dynamic = 'force-dynamic';

/**
 * Per-item transaction ledger — the "drill-down" screen users reach
 * by clicking an item name in the transactions list. Loads the item,
 * every purchase and issue referencing it (soft-deletes excluded),
 * and renders a running-balance ledger in the client.
 */
export default async function ItemLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();

  const [{ data: item }, { data: purchases }, { data: issues }] = await Promise.all([
    sb.from('items').select('id, name, code, stock_unit').eq('id', id).maybeSingle(),
    sb
      .from('purchases')
      .select(
        `id, receipt_date, received_qty, stock_qty, rate, invoice_no, remarks,
         vendor:parties(id, name)`,
      )
      .eq('item_id', id)
      .eq('is_deleted', false)
      .order('receipt_date', { ascending: true })
      .limit(1000),
    sb
      .from('issues')
      .select(
        `id, issue_date, qty, unit, rate, remarks, issued_to_legacy, worker_id,
         party:parties(id, name),
         location:location_units(id, name, code),
         dest:sites!issues_dest_site_id_fkey(id, code, name),
         worker:workers(id, code, full_name)`,
      )
      .eq('item_id', id)
      .eq('is_deleted', false)
      .order('issue_date', { ascending: true })
      .limit(1000),
  ]);

  if (!item) notFound();

  return <ItemLedgerClient item={item} purchases={purchases ?? []} issues={issues ?? []} />;
}
