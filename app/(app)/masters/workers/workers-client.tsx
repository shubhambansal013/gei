'use client';
import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createColumnHelper } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MasterShell } from '@/components/master-shell';
import { DataGrid } from '@/components/data-grid';
import { EmptyState } from '@/components/empty-state';
import { useOptimalPageSize } from '@/lib/hooks/use-optimal-page-size';
import { WorkerForm } from './worker-form';
import { TransferDialog } from './transfer-dialog';
import { AffiliationDialog } from './affiliation-dialog';
import type { Worker, SiteOption, PartyOption } from './types';

type Props = {
  workers: Worker[];
  sites: SiteOption[];
  parties: PartyOption[];
};

const col = createColumnHelper<Worker>();

const STATIC_COLS = [
  col.accessor('code', {
    header: 'Code',
    cell: (info) => <span className="font-mono tracking-wide">{info.getValue()}</span>,
  }),
  col.accessor('full_name', { header: 'Name' }),
  col.accessor('site_code', {
    header: 'Site',
    cell: (info) => info.getValue() ?? '—',
  }),
  col.accessor('employment_type', {
    header: 'Type',
    cell: (info) => info.getValue() ?? '—',
  }),
  col.accessor('contractor_name', {
    header: 'Contractor',
    cell: (info) => info.getValue() ?? '—',
  }),
  col.accessor('phone', {
    header: 'Phone',
    cell: (info) => info.getValue() ?? '—',
  }),
  col.accessor('is_active', {
    header: 'Active',
    cell: (info) => (info.getValue() ? 'Yes' : 'No'),
  }),
];

const EXPORT_COLS = [
  { key: 'code' as const, header: 'Code' },
  { key: 'full_name' as const, header: 'Name' },
  { key: 'site_code' as const, header: 'Site' },
  { key: 'employment_type' as const, header: 'Employment type' },
  { key: 'contractor_name' as const, header: 'Contractor' },
  { key: 'phone' as const, header: 'Phone' },
  { key: 'home_city' as const, header: 'Home city' },
];

export function WorkersClient({ workers, sites, parties }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [transferFor, setTransferFor] = useState<Worker | null>(null);
  const [affiliateFor, setAffiliateFor] = useState<Worker | null>(null);
  const pageSize = useOptimalPageSize();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter(
      (w) =>
        w.full_name.toLowerCase().includes(q) ||
        w.code.toLowerCase().includes(q) ||
        (w.phone ?? '').toLowerCase().includes(q) ||
        (w.site_code ?? '').toLowerCase().includes(q) ||
        (w.contractor_name ?? '').toLowerCase().includes(q),
    );
  }, [workers, search]);

  const openEdit = useCallback((w: Worker) => {
    setEditing(w);
    setSheetOpen(true);
  }, []);

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditing(null);
  }

  const columns = useMemo(
    (): ColumnDef<Worker, unknown>[] => [
      ...(STATIC_COLS as ColumnDef<Worker, unknown>[]),
      {
        id: 'actions',
        header: '',
        cell: (info) => {
          const w = info.row.original;
          return (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEdit(w)}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setTransferFor(w)}>
                Transfer
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAffiliateFor(w)}>
                Change affiliation
              </Button>
            </div>
          );
        },
      },
    ],
    [openEdit],
  );

  const defaultSiteId = sites[0]?.id ?? null;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Workers</h1>
      </header>

      <MasterShell
        title="workers"
        search={search}
        onSearch={setSearch}
        onNew={openCreate}
        canCreate
        exportFile="workers"
        exportCols={EXPORT_COLS}
        exportRows={filtered}
      >
        {filtered.length === 0 && !search.trim() ? (
          <EmptyState
            title="No workers yet"
            description="Add site workers to route issues and track placements."
            action={<Button onClick={openCreate}>+ New worker</Button>}
          />
        ) : (
          <DataGrid
            columns={columns}
            data={filtered}
            showRowNumbers
            pagination
            pageSize={pageSize}
            emptyMessage="No workers match your search."
          />
        )}
      </MasterShell>

      <Sheet open={sheetOpen} onOpenChange={closeSheet}>
        <SheetContent side="right" className="w-full overflow-y-auto p-6 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit worker' : 'New worker'}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {editing ? (
              <WorkerForm
                key={editing.id}
                mode="edit"
                defaultValues={{
                  id: editing.id,
                  full_name: editing.full_name,
                  phone: editing.phone,
                  home_city: editing.home_city,
                  is_active: editing.is_active,
                }}
                onSuccess={closeSheet}
              />
            ) : (
              <WorkerForm
                key="create"
                mode="create"
                sites={sites}
                parties={parties}
                defaultSiteId={defaultSiteId}
                onSuccess={closeSheet}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <TransferDialog
        worker={transferFor}
        sites={sites}
        onClose={() => setTransferFor(null)}
        onDone={() => {
          setTransferFor(null);
          router.refresh();
        }}
      />
      <AffiliationDialog
        worker={affiliateFor}
        parties={parties}
        onClose={() => setAffiliateFor(null)}
        onDone={() => {
          setAffiliateFor(null);
          router.refresh();
        }}
      />
    </div>
  );
}
