'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataGrid } from '@/components/data-grid';
import { ExportButton } from '@/components/export-button';
import { PrintButton } from '@/components/print-button';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import Link from 'next/link';
import { Trash2, Pencil } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { softDeletePurchase, softDeleteIssue } from './actions';
import { EditDialog, type EditTarget } from './edit-dialog';

/**
 * A unified row shape that both purchases and issues flatten into.
 * `type: 'IN'` reads amber for purchases, `'OUT'` reads green for issues
 * (semantic use of accent vs. chart-3).
 */
type UnifiedRow = {
  id: string;
  type: 'IN' | 'OUT';
  date: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  qty: number;
  unit: string;
  party: string;
  destination: string;
  ref: string; // invoice or issued-to
  amount: number | null;
};

type PurchaseRow = {
  id: string;
  receipt_date: string;
  received_qty: number;
  stock_qty: number | null;
  total_amount: number | null;
  invoice_no: string | null;
  item: { id: string; code: string | null; name: string; stock_unit: string } | null;
  vendor: { id: string; name: string } | null;
};

type IssueRow = {
  id: string;
  issue_date: string;
  qty: number;
  unit: string;
  issued_to_legacy: string | null;
  worker_id: string | null;
  item: { id: string; code: string | null; name: string; stock_unit: string } | null;
  party: { id: string; name: string } | null;
  location: { id: string; full_path: string; full_code: string } | null;
  dest: { id: string; code: string; name: string } | null;
  worker: { id: string; code: string; full_name: string } | null;
};

type Props = { purchases: PurchaseRow[]; issues: IssueRow[] };

export function TransactionsClient({ purchases, issues }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'IN' | 'OUT' } | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const rows = useMemo<UnifiedRow[]>(() => {
    const inRows: UnifiedRow[] = purchases.map((p) => ({
      id: p.id,
      type: 'IN',
      date: p.receipt_date,
      itemId: p.item?.id ?? '',
      itemCode: p.item?.code ?? '',
      itemName: p.item?.name ?? '—',
      qty: p.received_qty,
      unit: p.item?.stock_unit ?? '',
      party: p.vendor?.name ?? '',
      destination: p.vendor?.name ?? '',
      ref: p.invoice_no ?? '',
      amount: p.total_amount,
    }));
    const outRows: UnifiedRow[] = issues.map((i) => {
      const dest = i.location?.full_path ?? i.party?.name ?? (i.dest ? `→ ${i.dest.code}` : '—');
      return {
        id: i.id,
        type: 'OUT',
        date: i.issue_date,
        itemId: i.item?.id ?? '',
        itemCode: i.item?.code ?? '',
        itemName: i.item?.name ?? '—',
        qty: i.qty,
        unit: i.unit,
        party: i.party?.name ?? '',
        destination: dest,
        ref: i.worker ? `${i.worker.full_name} (${i.worker.code})` : (i.issued_to_legacy ?? ''),
        amount: null,
      };
    });
    return [...inRows, ...outRows].sort((a, b) => b.date.localeCompare(a.date));
  }, [purchases, issues]);

  const filtered = useMemo(() => {
    const lower = search.toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
      if (!search.trim()) return true;
      return (
        r.itemCode.toLowerCase().includes(lower) ||
        r.itemName.toLowerCase().includes(lower) ||
        r.destination.toLowerCase().includes(lower) ||
        r.ref.toLowerCase().includes(lower)
      );
    });
  }, [rows, search, typeFilter]);

  const columns: ColumnDef<UnifiedRow, unknown>[] = [
    { accessorKey: 'date', header: 'Date' },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ getValue }) => {
        const v = getValue() as 'IN' | 'OUT';
        return (
          <Badge
            variant="outline"
            className={
              v === 'IN'
                ? 'border-primary/50 text-primary bg-primary/5'
                : 'border-emerald-500/50 bg-emerald-500/5 text-emerald-700'
            }
          >
            {v}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'itemCode',
      header: 'Code',
      cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue() ?? '')}</span>,
    },
    {
      accessorKey: 'itemName',
      header: 'Item',
      cell: ({ row }) => (
        <Link
          href={`/inventory/item/${row.original.itemId}`}
          className="text-foreground hover:text-primary underline-offset-2 hover:underline"
        >
          {row.original.itemName}
        </Link>
      ),
    },
    {
      accessorKey: 'qty',
      header: 'Qty',
      cell: ({ getValue }) => (
        <span className="block text-right tabular-nums">{String(getValue() ?? '')}</span>
      ),
    },
    { accessorKey: 'unit', header: 'Unit' },
    { accessorKey: 'destination', header: 'Party / Location' },
    { accessorKey: 'ref', header: 'Ref' },
    {
      accessorKey: 'amount',
      header: 'Amount (₹)',
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return (
          <span className="block text-right tabular-nums">
            {v != null ? v.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() =>
              setEditTarget({
                id: row.original.id,
                type: row.original.type,
                currentQty: row.original.qty,
                currentRef: row.original.ref,
              })
            }
            className="text-muted-foreground hover:text-foreground"
            aria-label="Edit row"
            title="Edit (requires reason)"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget({ id: row.original.id, type: row.original.type })}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete row"
            title="Soft-delete (requires reason)"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const exportCols: { key: keyof UnifiedRow; header: string; numFmt?: string }[] = [
    { key: 'date', header: 'Date' },
    { key: 'type', header: 'Type' },
    { key: 'itemCode', header: 'Code' },
    { key: 'itemName', header: 'Item' },
    { key: 'qty', header: 'Qty', numFmt: '#,##0.00' },
    { key: 'unit', header: 'Unit' },
    { key: 'destination', header: 'Party / Location' },
    { key: 'ref', header: 'Ref' },
    { key: 'amount', header: 'Amount', numFmt: '₹#,##,##0.00' },
  ];

  return (
    <div className="space-y-4">
      <header className="print:hide flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {rows.length.toLocaleString('en-IN')} total · {filtered.length.toLocaleString('en-IN')}{' '}
            shown
          </p>
        </div>
      </header>

      <div className="print:hide flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search item, code, destination, ref…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-1 rounded-sm border p-0.5">
          {(['ALL', 'IN', 'OUT'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
                typeFilter === t
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ExportButton filename="transactions" columns={exportCols} rows={filtered} />
          <PrintButton />
          <Link href="/inventory/inward/new">
            <Button size="sm" variant="outline" type="button">
              + Purchase
            </Button>
          </Link>
          <Link href="/inventory/outward/new">
            <Button size="sm" type="button">
              + Issue
            </Button>
          </Link>
        </div>
      </div>

      <EditDialog
        key={editTarget?.id ?? 'none'}
        target={editTarget}
        onOpenChange={(o) => {
          if (!o) setEditTarget(null);
        }}
        onSuccess={() => {
          setEditTarget(null);
          startTransition(() => router.refresh());
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Soft-delete this transaction?"
        description="The row will be hidden from all lists but kept in the database with your reason attached. Hard delete is never allowed."
        destructive
        requireReason
        confirmLabel="Delete"
        onConfirm={async (reason) => {
          if (!deleteTarget || !reason) return;
          const fn = deleteTarget.type === 'IN' ? softDeletePurchase : softDeleteIssue;
          const res = await fn({ id: deleteTarget.id, reason });
          if (res.ok) {
            toast.success('Transaction deleted.');
            startTransition(() => router.refresh());
          } else {
            toast.error(res.error);
          }
        }}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? 'No transactions yet' : 'Nothing matches your filters'}
          description={
            rows.length === 0
              ? 'Record your first purchase or issue to see rows here.'
              : 'Try clearing the search or changing the type filter.'
          }
          action={
            rows.length === 0 ? (
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
            ) : null
          }
        />
      ) : (
        <DataGrid columns={columns} data={filtered} showRowNumbers />
      )}
    </div>
  );
}
