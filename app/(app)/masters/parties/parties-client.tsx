'use client';
import { useMemo, useCallback, useState } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MasterShell } from '@/components/master-shell';
import { DataGrid } from '@/components/data-grid';
import { EmptyState } from '@/components/empty-state';
import { PartyForm } from './party-form';

type Party = {
  id: string;
  name: string;
  type: string;
  type_label: string | null;
  short_code: string | null;
  gstin: string | null;
  phone: string | null;
  address: string | null;
};

type PartyType = { id: string; label: string };

type Props = {
  parties: Party[];
  partyTypes: PartyType[];
};

const col = createColumnHelper<Party>();

const STATIC_COLS = [
  col.accessor('short_code', {
    header: 'Code',
    cell: (info) => {
      const v = info.getValue();
      return v ? (
        <span className="font-mono text-xs uppercase">{v}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  }),
  col.accessor('name', { header: 'Name' }),
  col.accessor('type_label', {
    header: 'Type',
    cell: (info) => info.getValue() ?? '—',
  }),
  col.accessor('gstin', {
    header: 'GSTIN',
    cell: (info) => {
      const v = info.getValue();
      return v ? (
        <span className="font-mono text-xs">{v}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  }),
  col.accessor('phone', {
    header: 'Phone',
    cell: (info) => info.getValue() ?? '—',
  }),
];

const EXPORT_COLS = [
  { key: 'short_code' as const, header: 'Short code' },
  { key: 'name' as const, header: 'Name' },
  { key: 'type_label' as const, header: 'Type' },
  { key: 'gstin' as const, header: 'GSTIN' },
  { key: 'phone' as const, header: 'Phone' },
];

export function PartiesClient({ parties, partyTypes }: Props) {
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Party | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return parties;
    return parties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.short_code ?? '').toLowerCase().includes(q) ||
        (p.gstin ?? '').toLowerCase().includes(q) ||
        (p.phone ?? '').toLowerCase().includes(q),
    );
  }, [parties, search]);

  const openEdit = useCallback((party: Party) => {
    setEditing(party);
    setSheetOpen(true);
  }, []);

  // The actions column needs a stable callback reference; useCallback
  // prevents the column array from being re-created on every render.
  const columns = useMemo(
    (): ColumnDef<Party, unknown>[] => [
      ...(STATIC_COLS as ColumnDef<Party, unknown>[]),
      {
        id: 'actions',
        header: '',
        cell: (info) => (
          <Button variant="ghost" size="sm" onClick={() => openEdit(info.row.original)}>
            Edit
          </Button>
        ),
      },
    ],
    [openEdit],
  );

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Parties</h1>
      </header>

      <MasterShell
        title="Parties"
        search={search}
        onSearch={setSearch}
        onNew={openCreate}
        canCreate
        exportFile="parties"
        exportCols={EXPORT_COLS}
        exportRows={filtered}
      >
        {filtered.length === 0 && !search ? (
          <EmptyState
            title="No parties yet"
            description="Add suppliers, contractors, and clients to start recording issues."
            action={
              <Button size="sm" onClick={openCreate}>
                Add party
              </Button>
            }
          />
        ) : (
          <DataGrid columns={columns} data={filtered} showRowNumbers />
        )}
      </MasterShell>

      <Sheet open={sheetOpen} onOpenChange={closeSheet}>
        <SheetContent side="right" className="w-full overflow-y-auto p-6 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit party' : 'New party'}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {editing ? (
              <PartyForm
                key={editing.id}
                mode="edit"
                partyTypes={partyTypes}
                defaultValues={editing}
                onSuccess={closeSheet}
              />
            ) : (
              <PartyForm
                key="create"
                mode="create"
                partyTypes={partyTypes}
                onSuccess={closeSheet}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
