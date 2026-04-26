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
import { type WorkerOption } from '@/components/worker-picker';

/**
 * A unified row shape that both purchases and issues flatten into.
 * `type: 'PURCHASE'` reads amber for purchases, `'ISSUE'` reads green for issues
 * (semantic use of accent vs. chart-3).
 */
type UnifiedRow = {
  id: string;
  type: 'PURCHASE' | 'ISSUE';
  date: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  qty: number;
  unit: string;
  party: string;
  location: string;
  ref: string; // invoice or issued-to
  receivedUnit?: string | null | undefined;
  convFactor?: number | null | undefined;
  receivedQty?: number | undefined; // Only for PURCHASE
  siteId?: string | undefined;
  workerId?: string | null | undefined;
};

type PurchaseRow = {
  id: string;
  site_id: string;
  receipt_date: string;
  received_qty: number;
  received_unit: string;
  unit_conv_factor: number;
  stock_qty: number | null;
  total_amount: number | null;
  invoice_no: string | null;
  item: { id: string; code: string | null; name: string; stock_unit: string } | null;
  vendor: { id: string; name: string } | null;
};

type IssueRow = {
  id: string;
  site_id: string;
  issue_date: string;
  qty: number;
  unit: string;
  issued_to_legacy: string | null;
  worker_id: string | null;
  item: { id: string; code: string | null; name: string; stock_unit: string } | null;
  party: { id: string; name: string } | null;
  location: { id: string; name: string; code: string } | null;
  dest: { id: string; code: string; name: string } | null;
  worker: { id: string; code: string; full_name: string } | null;
};

type Unit = { id: string; label: string; category: string | null };

type Props = {
  purchases: PurchaseRow[];
  issues: IssueRow[];
  units: Unit[];
  workers: WorkerOption[];
};

export function TransactionsClient({ purchases, issues, units, workers }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PURCHASE' | 'ISSUE'>('ALL');
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    type: 'PURCHASE' | 'ISSUE';
  } | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const rows = useMemo<UnifiedRow[]>(() => {
    const inRows: UnifiedRow[] = purchases.map((p) => ({
      id: p.id,
      type: 'PURCHASE',
      date: p.receipt_date,
      itemId: p.item?.id ?? '',
      itemCode: p.item?.code ?? '',
      itemName: p.item?.name ?? '—',
      qty: p.stock_qty ?? 0,
      unit: p.item?.stock_unit ?? '',
      party: p.vendor?.name ?? '',
      location: '',
      ref: p.invoice_no ?? '',
      receivedUnit: p.received_unit,
      convFactor: p.unit_conv_factor,
      receivedQty: p.received_qty,
      siteId: p.site_id,
    }));
    const outRows: UnifiedRow[] = issues.map((i) => {
      return {
        id: i.id,
        type: 'ISSUE',
        date: i.issue_date,
        itemId: i.item?.id ?? '',
        itemCode: i.item?.code ?? '',
        itemName: i.item?.name ?? '—',
        qty: i.qty,
        unit: i.unit,
        party: i.party?.name ?? '',
        location: i.location?.name ?? (i.dest ? `→ ${i.dest.code}` : ''),
        ref: i.issued_to_legacy ?? '',
        siteId: i.site_id,
        workerId: i.worker_id,
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
        r.party.toLowerCase().includes(lower) ||
        r.location.toLowerCase().includes(lower) ||
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
        const v = getValue() as 'PURCHASE' | 'ISSUE';
        return (
          <Badge
            variant="outline"
            className={
              v === 'PURCHASE'
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
      cell: ({ row }) => (
        <Link
          href={`/inventory/item/${row.original.itemId}`}
          className="font-mono text-xs text-foreground hover:text-primary underline-offset-2 hover:underline"
        >
          {String(row.original.itemCode ?? '')}
        </Link>
      ),
    },
    {
      accessorKey: 'qty',
      header: 'Qty',
      cell: ({ row }) => {
        const r = row.original;
        if (
          r.type === 'PURCHASE' &&
          r.receivedUnit &&
          r.receivedQty != null &&
          r.receivedUnit !== r.unit
        ) {
          return (
            <div className="flex flex-col items-end">
              <span className="tabular-nums font-medium">{r.qty}</span>
              <span className="text-muted-foreground text-[10px]">
                ({r.receivedQty} {r.receivedUnit})
              </span>
            </div>
          );
        }
        return <span className="block text-right tabular-nums">{r.qty}</span>;
      },
    },
    { accessorKey: 'unit', header: 'Unit' },
    { accessorKey: 'party', header: 'Party' },
    { accessorKey: 'location', header: 'Location' },
    {
      accessorKey: 'ref',
      header: 'Ref',
      cell: ({ row }) => {
        const r = row.original;
        if (r.type === 'PURCHASE') return r.ref;
        // For issues, if we have a worker record, show that. Otherwise show the legacy text.
        if (r.workerId) {
          const w = workers.find((w) => w.id === r.workerId);
          if (w) return `${w.full_name} (${w.code})`;
        }
        return r.ref;
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
                currentQty:
                  row.original.type === 'PURCHASE' ? row.original.receivedQty! : row.original.qty,
                currentRef: row.original.ref,
                receivedUnit: row.original.receivedUnit ?? null,
                convFactor: row.original.convFactor ?? null,
                workerId: row.original.workerId ?? null,
                siteId: row.original.siteId,
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
    { key: 'qty', header: 'Qty', numFmt: '#,##0.00' },
    { key: 'unit', header: 'Unit' },
    { key: 'party', header: 'Party' },
    { key: 'location', header: 'Location' },
    { key: 'ref', header: 'Ref' },
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
          {(['ALL', 'PURCHASE', 'ISSUE'] as const).map((t) => (
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
        units={units}
        workers={workers}
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
          try {
            const fn = deleteTarget.type === 'PURCHASE' ? softDeletePurchase : softDeleteIssue;
            const res = await fn({ id: deleteTarget.id, reason });
            if (res.ok) {
              toast.success('Transaction deleted.');
              startTransition(() => router.refresh());
            } else {
              toast.error(res.error);
            }
          } catch (e) {
            console.error(e);
            toast.error('Failed to delete transaction.');
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
