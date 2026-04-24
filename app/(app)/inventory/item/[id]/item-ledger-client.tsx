'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DataGrid } from '@/components/data-grid';
import { ExportButton } from '@/components/export-button';
import { PrintButton } from '@/components/print-button';
import { EmptyState } from '@/components/empty-state';
import { ChevronLeft } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

type Item = { id: string; name: string; code: string | null; stock_unit: string };

type PurchaseRow = {
  id: string;
  receipt_date: string;
  received_qty: number;
  stock_qty: number | null;
  rate: number | null;
  invoice_no: string | null;
  remarks: string | null;
  vendor: { id: string; name: string } | null;
};

type IssueRow = {
  id: string;
  issue_date: string;
  qty: number;
  unit: string;
  rate: number | null;
  remarks: string | null;
  issued_to_legacy: string | null;
  worker_id: string | null;
  party: { id: string; name: string } | null;
  location: { id: string; name: string; code: string } | null;
  dest: { id: string; code: string; name: string } | null;
  worker: { id: string; code: string; full_name: string } | null;
};

type LedgerRow = {
  id: string;
  date: string;
  type: 'PURCHASE' | 'ISSUE';
  qtyIn: number | null;
  qtyOut: number | null;
  balance: number;
  party: string;
  rate: number | null;
  remarks: string;
};

type Props = {
  item: Item;
  purchases: PurchaseRow[];
  issues: IssueRow[];
};

/**
 * Ledger view for a single item. Rows are the chronological union of
 * purchases + issues; `balance` is the running sum of stock_qty-in
 * minus qty-out (oldest first).
 *
 * Print: sibling chrome uses `print:hide` so Cmd+P outputs just the
 * grid — matches how a storekeeper wants to hand a hard copy to an
 * auditor.
 */
export function ItemLedgerClient({ item, purchases, issues }: Props) {
  const rows = useMemo<LedgerRow[]>(() => {
    const ins: LedgerRow[] = purchases.map((p) => ({
      id: `P-${p.id}`,
      date: p.receipt_date,
      type: 'PURCHASE',
      qtyIn: p.stock_qty ?? p.received_qty,
      qtyOut: null,
      balance: 0,
      party: p.vendor?.name ?? '',
      rate: p.rate,
      remarks: p.invoice_no ? `Inv ${p.invoice_no}` : (p.remarks ?? ''),
    }));
    const outs: LedgerRow[] = issues.map((i) => ({
      id: `I-${i.id}`,
      date: i.issue_date,
      type: 'ISSUE',
      qtyIn: null,
      qtyOut: i.qty,
      balance: 0,
      party: i.location?.name ?? i.party?.name ?? (i.dest ? `→ ${i.dest.code}` : ''),
      rate: i.rate,
      remarks: i.worker
        ? `To ${i.worker.full_name} (${i.worker.code})`
        : i.issued_to_legacy
          ? `To ${i.issued_to_legacy}`
          : (i.remarks ?? ''),
    }));
    const combined = [...ins, ...outs].sort((a, b) => a.date.localeCompare(b.date));

    let balance = 0;
    for (const row of combined) {
      balance += (row.qtyIn ?? 0) - (row.qtyOut ?? 0);
      row.balance = balance;
    }
    return combined;
  }, [purchases, issues]);

  const currentStock = rows.length > 0 ? rows[rows.length - 1]!.balance : 0;

  const columns: ColumnDef<LedgerRow, unknown>[] = [
    { accessorKey: 'date', header: 'Date' },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ getValue }) => {
        const v = getValue() as 'PURCHASE' | 'ISSUE';
        return (
          <span
            className={
              v === 'PURCHASE' ? 'text-primary font-medium' : 'font-medium text-emerald-700'
            }
          >
            {v}
          </span>
        );
      },
    },
    {
      accessorKey: 'qtyIn',
      header: 'Purchase qty',
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return <span className="block text-right tabular-nums">{v != null ? v : ''}</span>;
      },
    },
    {
      accessorKey: 'qtyOut',
      header: 'Issue qty',
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return <span className="block text-right tabular-nums">{v != null ? v : ''}</span>;
      },
    },
    {
      accessorKey: 'balance',
      header: 'Balance',
      cell: ({ getValue }) => (
        <span className="block text-right font-semibold tabular-nums">{Number(getValue())}</span>
      ),
    },
    { accessorKey: 'party', header: 'Party / Location' },
    {
      accessorKey: 'rate',
      header: 'Rate (₹)',
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return (
          <span className="block text-right tabular-nums">
            {v != null ? v.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
          </span>
        );
      },
    },
    { accessorKey: 'remarks', header: 'Remarks' },
  ];

  const exportCols: { key: keyof LedgerRow; header: string; numFmt?: string }[] = [
    { key: 'date', header: 'Date' },
    { key: 'type', header: 'Type' },
    { key: 'qtyIn', header: 'Purchase qty', numFmt: '#,##0.00' },
    { key: 'qtyOut', header: 'Issue qty', numFmt: '#,##0.00' },
    { key: 'balance', header: 'Balance', numFmt: '#,##0.00' },
    { key: 'party', header: 'Party / Location' },
    { key: 'rate', header: 'Rate', numFmt: '₹#,##,##0.00' },
    { key: 'remarks', header: 'Remarks' },
  ];

  return (
    <div className="space-y-4">
      <div className="print:hide">
        <Link
          href="/inventory/transactions"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to transactions
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{item.name}</h1>
          <p className="text-muted-foreground mt-0.5 text-xs">
            <span className="font-mono">{item.code ?? '—'}</span> · stock unit {item.stock_unit}
          </p>
        </div>
        <div className="text-right">
          <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Current stock
          </div>
          <div className="font-mono text-2xl font-semibold tabular-nums">
            {currentStock.toLocaleString('en-IN')}{' '}
            <span className="text-sm">{item.stock_unit}</span>
          </div>
        </div>
      </header>

      <div className="print:hide flex items-center gap-2">
        <ExportButton
          filename={`ledger-${item.code ?? item.id}`}
          columns={exportCols}
          rows={rows}
        />
        <PrintButton />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No movements yet"
          description="Record a purchase or issue for this item to see the ledger."
          action={
            <div className="flex gap-2">
              <Link href="/inventory/inward/new">
                <Button variant="outline" type="button">
                  + Purchase
                </Button>
              </Link>
              <Link href="/inventory/outward/new">
                <Button type="button">+ Issue</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <DataGrid columns={columns} data={rows} showRowNumbers />
      )}
    </div>
  );
}
