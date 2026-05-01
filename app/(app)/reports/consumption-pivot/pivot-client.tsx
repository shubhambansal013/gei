'use client';
import { useMemo } from 'react';
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
  if (i.dest) return { key: `S:${i.dest.id}`, label: `Site ${i.dest.code}` };
  if (i.location && i.party) {
    return {
      key: `L:${i.location.id}|P:${i.party.id}`,
      label: `${i.location.name} (${i.party.name})`,
    };
  }
  if (i.location) return { key: `L:${i.location.id}`, label: i.location.name };
  if (i.party) return { key: `P:${i.party.id}`, label: i.party.name };
  return { key: 'U', label: '—' };
}

/**
 * In-browser aggregation: rows = Items, cols = Destinations.
 * Transposed from original (Dest × Item) per user feedback.
 */
export function PivotClient({ issues }: Props) {
  const {
    rowKeys,
    rowLabels,
    rowCodes,
    rowUnits,
    colKeys,
    colLabels,
    cells,
    rowTotals,
    colTotals,
    grand,
  } = useMemo(() => {
    const rowLabels = new Map<string, string>(); // item id -> name
    const rowCodes = new Map<string, string>(); // item id -> code
    const rowUnits = new Map<string, string>(); // item id -> unit
    const colLabels = new Map<string, string>(); // dest key -> label
    const cells = new Map<string, number>(); // `${itemId}|${destKey}` → qty
    const rowTotals = new Map<string, number>();
    const colTotals = new Map<string, number>();
    let grand = 0;

    for (const i of issues) {
      const d = destKey(i);
      const itemId = i.item?.id ?? 'unknown';
      const itemName = i.item?.name ?? '—';

      rowLabels.set(itemId, itemName);
      if (i.item?.code) rowCodes.set(itemId, i.item.code);
      if (i.item?.stock_unit) rowUnits.set(itemId, i.item.stock_unit);

      colLabels.set(d.key, d.label);

      const cellKey = `${itemId}|${d.key}`;
      cells.set(cellKey, (cells.get(cellKey) ?? 0) + i.qty);
      rowTotals.set(itemId, (rowTotals.get(itemId) ?? 0) + i.qty);
      colTotals.set(d.key, (colTotals.get(d.key) ?? 0) + i.qty);
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
      rowCodes,
      rowUnits,
      colKeys,
      colLabels,
      cells,
      rowTotals,
      colTotals,
      grand,
    };
  }, [issues]);

  const exportRows = useMemo(() => {
    return rowKeys.map((rk) => {
      const row: Record<string, string | number> = {
        item: `${rowCodes.get(rk) ? rowCodes.get(rk) + ' ' : ''}${rowLabels.get(rk) ?? ''}`,
        unit: rowUnits.get(rk) ?? '',
      };
      for (const ck of colKeys) {
        const cell = cells.get(`${rk}|${ck}`);
        row[colLabels.get(ck) ?? ck] = cell ?? 0;
      }
      row.total = rowTotals.get(rk) ?? 0;
      return row;
    });
  }, [rowKeys, rowLabels, rowCodes, rowUnits, colKeys, colLabels, cells, rowTotals]);

  const exportCols = useMemo(() => {
    return [
      { key: 'item' as const, header: 'Item' },
      { key: 'unit' as const, header: 'Unit' },
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
        <h1 className="text-xl font-semibold tracking-tight">Consumption Pivot</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Sum of issue qty by item (rows) and destination (columns).
        </p>
      </header>

      <div className="print:hide flex flex-wrap items-end gap-3">
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
          description="Record an issue first; the pivot fills in as you issue material."
        />
      ) : (
        <div className="max-h-[calc(100vh-12rem)] overflow-auto">
          <table className="excel-grid w-full border-collapse">
            <thead>
              <tr>
                <th className="bg-muted sticky top-0 left-0 z-30 text-left">Item</th>
                {colKeys.map((ck) => (
                  <th key={ck} className="sticky top-0 z-10 text-right">
                    {colLabels.get(ck)}
                  </th>
                ))}
                <th className="bg-primary/10 sticky top-0 z-10 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {rowKeys.map((rk) => (
                <tr key={rk}>
                  <td className="bg-card sticky left-0 z-20">
                    <div className="font-medium">{rowLabels.get(rk)}</div>
                    <div className="text-muted-foreground flex gap-2 text-[10px] font-normal uppercase">
                      {rowCodes.get(rk) && <span>{rowCodes.get(rk)}</span>}
                      <span>{rowUnits.get(rk)}</span>
                    </div>
                  </td>
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
                <td className="bg-muted sticky left-0 z-20">Total</td>
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
