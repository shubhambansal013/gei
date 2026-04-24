export const runtime = "edge";
import { supabaseServer } from '@/lib/supabase/server';
import { ItemsReportClient, type ItemReportRow } from './items-report-client';

export const dynamic = 'force-dynamic';

/**
 * Item-wise stock report. Uses the `stock_balance` view for purchased /
 * issued / current-stock totals and the `item_weighted_avg_cost` view
 * for per-item purchase-rate valuation. Both views are site-scoped by
 * RLS, so cross-site aggregation naturally reflects whatever the caller
 * has access to.
 *
 * The report is read-only: no mutations, no inline edits.
 */
export default async function ItemsReportPage() {
  const sb = await supabaseServer();

  const [stockResult, wacResult] = await Promise.all([
    sb
      .from('stock_balance')
      .select(
        'site_id, item_id, item_name, gei_code, unit, total_received, net_issued, current_stock',
      )
      .limit(10000),
    sb.from('item_weighted_avg_cost').select('site_id, item_id, wac_per_stock_unit').limit(10000),
  ]);

  if (stockResult.error) throw new Error(stockResult.error.message);
  if (wacResult.error) throw new Error(wacResult.error.message);

  // Aggregate across sites per item. A single item may appear on multiple
  // sites; we sum the qty columns and recompute a qty-weighted average
  // rate so a site with more stock pulls the valuation toward its own rate.
  type Agg = {
    item_id: string;
    code: string;
    name: string;
    unit: string;
    purchased: number;
    issued: number;
    current: number;
    // qty-weighted numerator/denominator for the average rate.
    rateNumerator: number;
    rateDenominator: number;
  };

  const wacByKey = new Map<string, number>();
  for (const w of wacResult.data ?? []) {
    if (!w.site_id || !w.item_id || w.wac_per_stock_unit == null) continue;
    wacByKey.set(`${w.site_id}:${w.item_id}`, w.wac_per_stock_unit);
  }

  const byItem = new Map<string, Agg>();
  for (const s of stockResult.data ?? []) {
    if (!s.item_id) continue;
    const prev: Agg = byItem.get(s.item_id) ?? {
      item_id: s.item_id,
      code: s.gei_code ?? '',
      name: s.item_name ?? '—',
      unit: s.unit ?? '',
      purchased: 0,
      issued: 0,
      current: 0,
      rateNumerator: 0,
      rateDenominator: 0,
    };
    const received = s.total_received ?? 0;
    prev.purchased += received;
    prev.issued += s.net_issued ?? 0;
    prev.current += s.current_stock ?? 0;
    const rate = s.site_id ? wacByKey.get(`${s.site_id}:${s.item_id}`) : undefined;
    if (rate != null && received > 0) {
      prev.rateNumerator += rate * received;
      prev.rateDenominator += received;
    }
    byItem.set(s.item_id, prev);
  }

  const rows: ItemReportRow[] = [...byItem.values()]
    .map((a) => {
      const rate = a.rateDenominator > 0 ? a.rateNumerator / a.rateDenominator : null;
      const value = rate != null ? a.current * rate : null;
      return {
        itemId: a.item_id,
        code: a.code,
        name: a.name,
        unit: a.unit,
        purchased: a.purchased,
        issued: a.issued,
        current: a.current,
        value,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return <ItemsReportClient rows={rows} />;
}
