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
  party: { id: string; name: string; short_code: string | null } | null;
  location: { id: string; name: string; code: string } | null;
  dest: { id: string; code: string; name: string } | null;
};

type Props = { issues: IssueRow[] };

function destKey(i: IssueRow): { key: string; label: string; code: string } {
  if (i.location)
    return { key: `L:${i.location.id}`, label: i.location.name, code: i.location.code };
  if (i.party)
    return {
      key: `P:${i.party.id}`,
      label: i.party.name,
      code: i.party.short_code ?? i.party.name.substring(0, 8),
    };
  if (i.dest)
    return { key: `S:${i.dest.id}`, label: i.dest.name, code: i.dest.code };
  return { key: 'U', label: '—', code: '—' };
}

const fmtQty = (n: number) =>
  n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * In-browser aggregation: rows = unique items, cols = unique
 * destinations, cells = Σ qty over the current date range. Small enough to
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

  const { rowKeys, rowData, colKeys, colLabels, colCodes, cells, rowTotals, colTotals, grand } =
    useMemo(() => {
      const rowData = new Map<string, { name: string; code: string; unit: string }>();
      const colLabels = new Map<string, string>();
      const colCodes = new Map<string, string>();
      const cells = new Map<string, number>(); // `${rowKey}|${colKey}` → qty
      const rowTotals = new Map<string, number>();
      const colTotals = new Map<string, number>();
      let grand = 0;

      for (const i of filtered) {
        const d = destKey(i);
        const itemId = i.item?.id ?? 'unknown';

        if (!rowData.has(itemId)) {
          rowData.set(itemId, {
            name: i.item?.name ?? '—',
            code: i.item?.code ?? '—',
            unit: i.item?.stock_unit ?? '',
          });
        }

        colLabels.set(d.key, d.label);
        colCodes.set(d.key, d.code);

        const cellKey = `${itemId}|${d.key}`;
        cells.set(cellKey, (cells.get(cellKey) ?? 0) + i.qty);
        rowTotals.set(itemId, (rowTotals.get(itemId) ?? 0) + i.qty);
        colTotals.set(d.key, (colTotals.get(d.key) ?? 0) + i.qty);
        grand += i.qty;
      }

      const rowKeys = [...rowData.keys()].sort((a, b) => {
        const itemA = rowData.get(a)!;
        const itemB = rowData.get(b)!;
        return itemA.name.localeCompare(itemB.name);
      });

      const colKeys = [...colLabels.keys()].sort((a, b) =>
        (colLabels.get(a) ?? '').localeCompare(colLabels.get(b) ?? ''),
      );

      return {
        rowKeys,
        rowData,
        colKeys,
        colLabels,
        colCodes,
        cells,
        rowTotals,
        colTotals,
        grand,
      };
    }, [filtered]);

  // Export as wide rows — one entry per Item with every destination column.
  const exportRows = useMemo(() => {
    return rowKeys.map((rk) => {
      const item = rowData.get(rk)!;
      const row: Record<string, string | number> = {
        code: item.code,
        name: item.name,
        unit: item.unit,
      };
      for (const ck of colKeys) {
        const cell = cells.get(`${rk}|${ck}`);
        row[colCodes.get(ck) ?? ck] = cell ?? 0;
      }
      row.total = rowTotals.get(rk) ?? 0;
      return row;
    });
  }, [rowKeys, rowData, colKeys, colCodes, cells, rowTotals]);

  const exportCols = useMemo(() => {
    return [
      { key: 'code' as const, header: 'Code' },
      { key: 'name' as const, header: 'Item Name' },
      { key: 'unit' as const, header: 'Unit' },
      ...colKeys.map((ck) => ({
        key: (colCodes.get(ck) ?? ck) as keyof (typeof exportRows)[number],
        header: colLabels.get(ck) ?? ck,
        numFmt: '#,##0.00',
      })),
      { key: 'total' as const, header: 'Total', numFmt: '#,##0.00' },
    ];
  }, [colKeys, colCodes, colLabels]);

  return (
    <div className="space-y-4">
      <header className="print:hide">
        <h1 className="text-xl font-semibold tracking-tight">Consumption Pivot</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Sum of issue qty by item (rows) and destination (columns). Date-range filter applies to
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
            sheetName="Item × Destination"
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
                <th className="bg-muted sticky left-0 z-20 text-left">Item</th>
                {colKeys.map((ck) => (
                  <th key={ck} className="text-right">
                    <div>{colCodes.get(ck)}</div>
                    <div className="text-muted-foreground text-[10px] font-normal">
                      {colLabels.get(ck) ?? ''}
                    </div>
                  </th>
                ))}
                <th className="bg-primary/10 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {rowKeys.map((rk) => {
                const item = rowData.get(rk)!;
                return (
                  <tr key={rk}>
                    <td className="bg-card sticky left-0 z-10 font-medium">
                      <div className="flex flex-col">
                        <span>{item.name}</span>
                        <div className="text-muted-foreground flex gap-1.5 text-[10px] font-normal">
                          <span className="font-mono">{item.code}</span>
                          <span>·</span>
                          <span>{item.unit}</span>
                        </div>
                      </div>
                    </td>
                    {colKeys.map((ck) => {
                      const cell = cells.get(`${rk}|${ck}`);
                      return (
                        <td key={ck} className="text-right tabular-nums">
                          {cell != null ? fmtQty(cell) : ''}
                        </td>
                      );
                    })}
                    <td className="bg-primary/5 text-right font-semibold tabular-nums">
                      {fmtQty(rowTotals.get(rk) ?? 0)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-muted/60 font-semibold">
                <td className="bg-muted sticky left-0 z-10">Total</td>
                {colKeys.map((ck) => (
                  <td key={ck} className="text-right tabular-nums">
                    {fmtQty(colTotals.get(ck) ?? 0)}
                  </td>
                ))}
                <td className="bg-primary/10 text-right tabular-nums">{fmtQty(grand)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
