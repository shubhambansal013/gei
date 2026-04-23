import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { EmptyState } from '@/components/empty-state';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Package, Wallet } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * Phase 2 dashboard. Four headline KPIs computed server-side from the
 * `stock_balance` view and this-month slices of `purchases`/`issues`,
 * plus a low-stock alert widget, top-10 consumption (last 30 days),
 * and the most recent 10 transactions.
 *
 * Everything is scoped by RLS — the SELECT only returns rows on sites
 * the signed-in user has `INVENTORY.VIEW` on. No site-switcher
 * filtering yet; the dashboard aggregates across every accessible site.
 */
export default async function DashboardPage() {
  const sb = await supabaseServer();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [
    { data: stock },
    { data: inwardMonth },
    { data: outwardMonth },
    { data: reorderItems },
    { data: consumption },
    { data: recentIn },
    { data: recentOut },
    { data: costBasis },
  ] = await Promise.all([
    sb.from('stock_balance').select('site_id, item_id, current_stock').limit(5000),
    sb
      .from('purchases')
      .select('total_amount, stock_qty')
      .gte('receipt_date', monthStartStr)
      .lte('receipt_date', today)
      .eq('is_deleted', false),
    sb
      .from('issues')
      .select('qty')
      .gte('issue_date', monthStartStr)
      .lte('issue_date', today)
      .eq('is_deleted', false),
    sb.from('items').select('id, name, code, unit, reorder_level').not('reorder_level', 'is', null),
    sb
      .from('issues')
      .select('qty, item:items(id, code, name, unit)')
      .gte('issue_date', thirtyDaysAgo)
      .eq('is_deleted', false)
      .limit(2000),
    sb
      .from('purchases')
      .select('id, receipt_date, received_qty, total_amount, item:items(id, code, name, unit)')
      .eq('is_deleted', false)
      .order('receipt_date', { ascending: false })
      .limit(10),
    sb
      .from('issues')
      .select('id, issue_date, qty, item:items(code, name, unit)')
      .eq('is_deleted', false)
      .order('issue_date', { ascending: false })
      .limit(10),
    // Last-90-days running average cost per item. Aggregated in-memory
    // below. TODO(#17): moving-average is a stand-in; awaiting FIFO/WAC
    // spec decision before we adopt the real costing method.
    sb
      .from('purchases')
      .select('item_id, total_amount, stock_qty')
      .gte('receipt_date', ninetyDaysAgo)
      .eq('is_deleted', false)
      .limit(10000),
  ]);

  // SKUs with positive stock
  const activeSkuIds = new Set(
    (stock ?? [])
      .filter((s) => (s.current_stock ?? 0) > 0 && s.site_id && s.item_id)
      .map((s) => `${s.site_id}:${s.item_id}`),
  );
  const skuCount = activeSkuIds.size;

  const inwardValue = (inwardMonth ?? []).reduce((sum, p) => sum + (p.total_amount ?? 0), 0);
  const outwardQty = (outwardMonth ?? []).reduce((sum, i) => sum + (i.qty ?? 0), 0);
  const inwardQty = (inwardMonth ?? []).reduce((sum, p) => sum + (p.stock_qty ?? 0), 0);

  // Low-stock alert: join reorder items with current stock
  const stockByItem = new Map<string, number>();
  for (const s of stock ?? []) {
    if (!s.item_id) continue;
    stockByItem.set(s.item_id, (stockByItem.get(s.item_id) ?? 0) + (s.current_stock ?? 0));
  }
  const lowStock = (reorderItems ?? [])
    .map((i) => ({ ...i, current: stockByItem.get(i.id) ?? 0 }))
    .filter((i) => i.reorder_level != null && i.current < i.reorder_level)
    .sort((a, b) => a.current / a.reorder_level! - b.current / b.reorder_level!)
    .slice(0, 8);

  // Running-average purchase rate per item over the last 90 days.
  // avg = Σ total_amount / Σ stock_qty. Used as a read-only heuristic for
  // display only — cost column is purely indicative until a proper
  // costing method is chosen.
  // TODO(#17): moving-average is a stand-in; awaiting FIFO/WAC spec decision.
  const costAgg = new Map<string, { amount: number; qty: number }>();
  for (const p of costBasis ?? []) {
    if (!p.item_id) continue;
    const amt = p.total_amount ?? 0;
    const qty = p.stock_qty ?? 0;
    if (qty <= 0) continue;
    const prev = costAgg.get(p.item_id) ?? { amount: 0, qty: 0 };
    prev.amount += amt;
    prev.qty += qty;
    costAgg.set(p.item_id, prev);
  }
  const avgCostByItem = new Map<string, number>();
  for (const [id, v] of costAgg) {
    if (v.qty > 0) avgCostByItem.set(id, v.amount / v.qty);
  }

  // Top 10 items by outward qty over last 30 days
  const byItem = new Map<
    string,
    { name: string; code: string; unit: string; qty: number; id: string; amount: number }
  >();
  for (const row of consumption ?? []) {
    const item = row.item;
    if (!item) continue;
    const prev = byItem.get(item.id) ?? {
      id: item.id,
      name: item.name,
      code: item.code ?? '',
      unit: item.unit,
      qty: 0,
      amount: 0,
    };
    const q = row.qty ?? 0;
    prev.qty += q;
    const rate = avgCostByItem.get(item.id);
    if (rate != null) prev.amount += q * rate;
    byItem.set(item.id, prev);
  }
  const topConsumption = [...byItem.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);
  const topMaxQty = topConsumption[0]?.qty ?? 0;

  // Recent 10 transactions (merge + sort)
  type Recent = {
    id: string;
    type: 'IN' | 'OUT';
    date: string;
    qty: number;
    itemCode: string;
    itemName: string;
    unit: string;
    amount: number | null;
  };
  const recent: Recent[] = [
    ...(recentIn ?? []).map(
      (p): Recent => ({
        id: p.id,
        type: 'IN',
        date: p.receipt_date,
        qty: p.received_qty,
        itemCode: p.item?.code ?? '',
        itemName: p.item?.name ?? '—',
        unit: p.item?.unit ?? '',
        amount: p.total_amount,
      }),
    ),
    ...(recentOut ?? []).map(
      (i): Recent => ({
        id: i.id,
        type: 'OUT',
        date: i.issue_date,
        qty: i.qty,
        itemCode: i.item?.code ?? '',
        itemName: i.item?.name ?? '—',
        unit: i.item?.unit ?? '',
        // OUT rows show "—"; no costing method chosen yet.
        // TODO(#17): once FIFO/WAC is decided, populate from cost-of-goods-issued.
        amount: null,
      }),
    ),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  const fmtINR = (n: number) =>
    n.toLocaleString('en-IN', { maximumFractionDigits: 0, style: 'currency', currency: 'INR' });
  const fmtNum = (n: number) => n.toLocaleString('en-IN');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Live across every site you have access to. Recent and this-month figures update on every
          page load.
        </p>
      </header>

      <section
        aria-label="Key metrics"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Kpi label="Inward value" value={fmtINR(inwardValue)} sub="this month" icon={Wallet} />
        <Kpi
          label="SKUs in stock"
          value={fmtNum(skuCount)}
          sub="site × item combos"
          icon={Package}
        />
        <Kpi
          label="Inward qty"
          value={fmtNum(Math.round(inwardQty))}
          sub="this month"
          icon={ArrowDownToLine}
        />
        <Kpi
          label="Outward qty"
          value={fmtNum(Math.round(outwardQty))}
          sub="this month"
          icon={ArrowUpFromLine}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="bg-card rounded-md border p-5 shadow-sm">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <AlertTriangle className="text-destructive h-4 w-4" />
              Low-stock alerts
            </h2>
            {lowStock.length > 0 && (
              <span className="text-muted-foreground text-xs">
                {lowStock.length} item{lowStock.length === 1 ? '' : 's'}
              </span>
            )}
          </header>
          {lowStock.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Every item with a reorder level is above threshold. Set{' '}
              <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                reorder_level
              </code>{' '}
              in the item master to enable alerts.
            </p>
          ) : (
            <ul className="divide-y">
              {lowStock.map((i) => (
                <li key={i.id} className="flex items-baseline justify-between py-2 text-sm">
                  <Link
                    href={`/inventory/item/${i.id}`}
                    className="hover:text-primary truncate underline-offset-2 hover:underline"
                  >
                    <span className="font-mono text-xs">{i.code ?? ''}</span>{' '}
                    <span className="font-medium">{i.name}</span>
                  </Link>
                  <span className="ml-2 shrink-0 font-mono text-xs tabular-nums">
                    <span className="text-destructive font-semibold">{fmtNum(i.current)}</span>{' '}
                    <span className="text-muted-foreground">
                      / {fmtNum(i.reorder_level ?? 0)} {i.unit}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-card rounded-md border p-5 shadow-sm">
          <header className="mb-3">
            <h2 className="text-sm font-semibold">Top 10 consumption (last 30 days)</h2>
            <p className="text-muted-foreground text-xs">
              By outward qty · amount @ 90-day running avg purchase rate
            </p>
          </header>
          {topConsumption.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No outward movements in the last 30 days.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {topConsumption.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/inventory/item/${c.id}`}
                    className="grid grid-cols-[1fr_auto_auto] items-baseline gap-3 py-0.5 text-sm"
                  >
                    <div className="min-w-0 truncate">
                      <span className="text-muted-foreground font-mono text-xs">{c.code}</span>{' '}
                      {c.name}
                    </div>
                    <div className="text-right font-mono text-xs tabular-nums">
                      {fmtNum(c.qty)} {c.unit}
                    </div>
                    <div className="text-muted-foreground w-24 text-right font-mono text-xs tabular-nums">
                      {c.amount > 0 ? fmtINR(c.amount) : '—'}
                    </div>
                  </Link>
                  <div className="bg-primary/20 h-1 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full"
                      style={{ width: `${topMaxQty > 0 ? (c.qty / topMaxQty) * 100 : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="bg-card rounded-md border p-5 shadow-sm">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent transactions</h2>
          <Link
            href="/inventory/transactions"
            className="text-primary text-xs underline-offset-2 hover:underline"
          >
            View all →
          </Link>
        </header>
        {recent.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Record an inward or outward to light this up."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="py-1.5 text-left font-medium">Date</th>
                <th className="py-1.5 text-left font-medium">Type</th>
                <th className="py-1.5 text-left font-medium">Item</th>
                <th className="py-1.5 text-right font-medium">Qty</th>
                <th className="py-1.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recent.map((r) => (
                <tr key={`${r.type}-${r.id}`} className="hover:bg-muted/40">
                  <td className="py-1.5 font-mono text-xs">{r.date}</td>
                  <td className="py-1.5">
                    <span
                      className={
                        r.type === 'IN'
                          ? 'text-primary font-semibold'
                          : 'font-semibold text-emerald-700'
                      }
                    >
                      {r.type}
                    </span>
                  </td>
                  <td className="py-1.5">
                    <span className="text-muted-foreground font-mono text-xs">{r.itemCode}</span>{' '}
                    {r.itemName}
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums">
                    {fmtNum(r.qty)} {r.unit}
                  </td>
                  <td className="text-muted-foreground py-1.5 text-right font-mono tabular-nums">
                    {r.amount != null ? fmtINR(r.amount) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-card rounded-md border p-4 shadow-sm">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-muted-foreground mt-1 text-xs">{sub}</div>
    </div>
  );
}
