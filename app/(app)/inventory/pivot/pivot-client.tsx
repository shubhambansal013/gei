'use client';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PrintButton } from '@/components/print-button';
import { ExportButton } from '@/components/export-button';
import { EmptyState } from '@/components/empty-state';

type IssueRow = {
  id: string;
  qty: number;
  issue_date: string;
  item: { id: string; code: string | null; name: string; stock_unit: string } | null;
  party: { id: string; name: string } | null;
  location: { id: string; name: string; code: string } | null;
  dest: { id: string; code: string; name: string } | null;
};

type Props = { issues: IssueRow[] };

function destKey(i: IssueRow): { key: string; label: string } {
  if (i.location) return { key: `L:${i.location.id}`, label: i.location.name };
  if (i.party) return { key: `P:${i.party.id}`, label: i.party.name };
  if (i.dest) return { key: `S:${i.dest.id}`, label: `Site ${i.dest.code}` };
  return { key: 'U', label: '—' };
}

/**
 * In-browser aggregation: rows = unique destinations, cols = unique
 * items, cells = Σ qty over the current date range. Small enough to
 * render instantly for a few thousand issue rows. Totals row + col.
 */
export function PivotClient({ issues }: Props) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filtered = useMemo(() => {
    return issues.filter((i) => {
      if (from && i.issue_date < from) return false;
      if (to && i.issue_date > to) return false;
      return true;
    });
  }, [issues, from, to]);

  const { rowKeys, rowLabels, colKeys, colLabels, colUnit, cells, rowTotals, colTotals, grand } =
    useMemo(() => {
      const rowLabels = new Map<string, string>();
      const colLabels = new Map<string, string>();
      const colUnit = new Map<string, string>();
      const cells = new Map<string, number>(); // `${rowKey}|${colKey}` → qty
      const rowTotals = new Map<string, number>();
      const colTotals = new Map<string, number>();
      let grand = 0;

      for (const i of filtered) {
        const r = destKey(i);
        const itemId = i.item?.id ?? 'unknown';
        const itemLabel = i.item?.name ?? '—';
        rowLabels.set(r.key, r.label);
        colLabels.set(itemId, itemLabel);
        if (i.item?.stock_unit) colUnit.set(itemId, i.item.stock_unit);
        const cellKey = `${r.key}|${itemId}`;
        cells.set(cellKey, (cells.get(cellKey) ?? 0) + i.qty);
        rowTotals.set(r.key, (rowTotals.get(r.key) ?? 0) + i.qty);
        colTotals.set(itemId, (colTotals.get(itemId) ?? 0) + i.qty);
        grand += i.qty;
      }

      const rowKeys = [...rowLabels.keys()].sort((a, b) =>
        (rowLabels.get(a) ?? '').localeCompare(rowLabels.get(b) ?? ''),
      );
      const colKeys = [...colLabels.keys()].sort((a, b) =>
        (colLabels.get(a) ?? '').localeCompare(colLabels.get(b) ?? ''),
      );

      return {
        rowKeys,
        rowLabels,
        colKeys,
        colLabels,
        colUnit,
        cells,
        rowTotals,
        colTotals,
        grand,
      };
    }, [filtered]);

  // Export as wide rows — one entry per destination with every item column.
  const exportRows = useMemo(() => {
    return rowKeys.map((rk) => {
      const row: Record<string, string | number> = { destination: rowLabels.get(rk) ?? '' };
      for (const ck of colKeys) {
        const cell = cells.get(`${rk}|${ck}`);
        row[colLabels.get(ck) ?? ck] = cell ?? 0;
      }
      row.total = rowTotals.get(rk) ?? 0;
      return row;
    });
  }, [rowKeys, rowLabels, colKeys, colLabels, cells, rowTotals]);

  const exportCols = useMemo(() => {
    return [
      { key: 'destination' as const, header: 'Destination' },
      ...colKeys.map((ck) => ({
        key: (colLabels.get(ck) ?? ck) as keyof (typeof exportRows)[number],
        header: colLabels.get(ck) ?? ck,
        numFmt: '#,##0.00',
      })),
      { key: 'total' as const, header: 'Total', numFmt: '#,##0.00' },
    ];
  }, [colKeys, colLabels]);

  return (
    <div className="space-y-4">
      <header className="print:hide">
        <h1 className="text-xl font-semibold tracking-tight">Destination × item pivot</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Sum of issue qty by destination (rows) and item (columns). Date-range filter applies to
          `issue_date`.
        </p>
      </header>

      <div className="print:hide flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="from" className="text-xs">
            From
          </Label>
          <Input
            id="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to" className="text-xs">
            To
          </Label>
          <Input
            id="to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ExportButton
            filename="pivot"
            sheetName="Destination × Item"
            columns={exportCols}
            rows={exportRows}
          />
          <PrintButton />
        </div>
      </div>

      {rowKeys.length === 0 || colKeys.length === 0 ? (
        <EmptyState
          title="No issues yet"
          description={
            issues.length === 0
              ? 'Record an issue first; the pivot fills in as you issue material.'
              : 'Try widening the date range.'
          }
        />
      ) : (
        <div className="overflow-auto">
          <table className="excel-grid w-full border-collapse">
            <thead>
              <tr>
                <th className="bg-muted sticky left-0 z-20 text-left">Destination</th>
                {colKeys.map((ck) => (
                  <th key={ck} className="text-right">
                    <div>{colLabels.get(ck)}</div>
                    <div className="text-muted-foreground text-[10px] font-normal">
                      {colUnit.get(ck) ?? ''}
                    </div>
                  </th>
                ))}
                <th className="bg-primary/10 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {rowKeys.map((rk) => (
                <tr key={rk}>
                  <td className="bg-card sticky left-0 z-10 font-medium">{rowLabels.get(rk)}</td>
                  {colKeys.map((ck) => {
                    const cell = cells.get(`${rk}|${ck}`);
                    return (
                      <td key={ck} className="text-right tabular-nums">
                        {cell != null ? cell.toLocaleString('en-IN') : ''}
                      </td>
                    );
                  })}
                  <td className="bg-primary/5 text-right font-semibold tabular-nums">
                    {(rowTotals.get(rk) ?? 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/60 font-semibold">
                <td className="bg-muted sticky left-0 z-10">Total</td>
                {colKeys.map((ck) => (
                  <td key={ck} className="text-right tabular-nums">
                    {(colTotals.get(ck) ?? 0).toLocaleString('en-IN')}
                  </td>
                ))}
                <td className="bg-primary/10 text-right tabular-nums">
                  {grand.toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
