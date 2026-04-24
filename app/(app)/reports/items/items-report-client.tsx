'use client';
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { DataGrid } from '@/components/data-grid';
import { EmptyState } from '@/components/empty-state';
import { ExportButton } from '@/components/export-button';
import { PrintButton } from '@/components/print-button';

export type ItemReportRow = {
  itemId: string;
  code: string;
  name: string;
  unit: string;
  purchased: number;
  issued: number;
  current: number;
  /** INR value of current stock at the qty-weighted 90-day avg purchase rate. */
  value: number | null;
};

type Props = { rows: ItemReportRow[] };

const fmtQty = (n: number) =>
  n.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  });

const fmtINR = (n: number) =>
  n.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'INR',
  });

/**
 * Item-wise stock report. Read-only; reuses DataGrid for presentation and
 * the shared Export/Print buttons for CSV/XLSX/print. Site scoping comes
 * from RLS on the `stock_balance` + `item_weighted_avg_cost` views — this
 * component never filters by site itself.
 */
export function ItemsReportClient({ rows }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
  }, [rows, search]);

  const columns: ColumnDef<ItemReportRow, unknown>[] = useMemo(
    () => [
      {
        accessorKey: 'code',
        header: 'Code',
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{String(getValue() ?? '')}</span>
        ),
      },
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'unit', header: 'Stock unit' },
      {
        accessorKey: 'purchased',
        header: 'Total purchased',
        cell: ({ getValue }) => (
          <span className="block text-right font-mono tabular-nums">
            {fmtQty(Number(getValue() ?? 0))}
          </span>
        ),
      },
      {
        accessorKey: 'issued',
        header: 'Total issued',
        cell: ({ getValue }) => (
          <span className="block text-right font-mono tabular-nums">
            {fmtQty(Number(getValue() ?? 0))}
          </span>
        ),
      },
      {
        accessorKey: 'current',
        header: 'Current stock',
        cell: ({ getValue }) => (
          <span className="block text-right font-mono font-semibold tabular-nums">
            {fmtQty(Number(getValue() ?? 0))}
          </span>
        ),
      },
      {
        accessorKey: 'value',
        header: 'Value (₹)',
        cell: ({ getValue }) => {
          const v = getValue() as number | null;
          return (
            <span className="block text-right font-mono tabular-nums">
              {v != null ? fmtINR(v) : '—'}
            </span>
          );
        },
      },
    ],
    [],
  );

  // Flatten rows to the exact shape the exporters need — no nested objects,
  // and numeric values for XLSX formatting.
  type ExportRow = {
    code: string;
    name: string;
    unit: string;
    purchased: number;
    issued: number;
    current: number;
    value: number | string;
  };
  const exportRows: ExportRow[] = filtered.map((r) => ({
    code: r.code,
    name: r.name,
    unit: r.unit,
    purchased: r.purchased,
    issued: r.issued,
    current: r.current,
    value: r.value ?? '',
  }));
  const exportCols: { key: keyof ExportRow; header: string; numFmt?: string }[] = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'unit', header: 'Stock unit' },
    { key: 'purchased', header: 'Total purchased', numFmt: '#,##0.00' },
    { key: 'issued', header: 'Total issued', numFmt: '#,##0.00' },
    { key: 'current', header: 'Current stock', numFmt: '#,##0.00' },
    { key: 'value', header: 'Value', numFmt: '₹#,##,##0.00' },
  ];

  return (
    <div className="space-y-4">
      <header className="print:hide flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Item-wise stock</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {rows.length.toLocaleString('en-IN')} items · value at 90-day avg purchase rate
          </p>
        </div>
      </header>

      <div className="print:hide flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search code or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="ml-auto flex items-center gap-2">
          <ExportButton
            filename="items-report"
            sheetName="Item-wise stock"
            columns={exportCols}
            rows={exportRows}
          />
          <PrintButton />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? 'No stock movements yet' : 'Nothing matches your search'}
          description={
            rows.length === 0
              ? 'Record a purchase transaction; the report populates on the next load.'
              : 'Try a different code or name.'
          }
        />
      ) : (
        <DataGrid columns={columns} data={filtered} showRowNumbers />
      )}
    </div>
  );
}
