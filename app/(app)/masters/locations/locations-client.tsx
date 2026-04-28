'use client';
import { useMemo, useCallback, useState } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MasterShell } from '@/components/master-shell';
import { DataGrid } from '@/components/data-grid';
import { EmptyState } from '@/components/empty-state';
import { useOptimalPageSize } from '@/lib/hooks/use-optimal-page-size';
import { LocationForm } from './location-form';

type Unit = {
  id: string;
  site_id: string;
  name: string;
  code: string;
  type: string;
  site_code: string | null;
  site_name: string | null;
  type_label: string | null;
};
type Site = { id: string; code: string; name: string };
type TypeRow = { id: string; label: string };

type Props = {
  units: Unit[];
  sites: Site[];
  types: TypeRow[];
};

const col = createColumnHelper<Unit>();

const STATIC_COLS = [
  col.accessor('site_code', {
    header: 'Site',
    cell: (info) => info.getValue() ?? '—',
  }),
  col.accessor('code', {
    header: 'Code',
    cell: (info) => <span className="font-mono text-xs uppercase">{info.getValue()}</span>,
  }),
  col.accessor('name', { header: 'Name' }),
  col.accessor('type_label', {
    header: 'Type',
    cell: (info) => info.getValue() ?? '—',
  }),
];

const EXPORT_COLS = [
  { key: 'site_code' as const, header: 'Site code' },
  { key: 'site_name' as const, header: 'Site name' },
  { key: 'code' as const, header: 'Code' },
  { key: 'name' as const, header: 'Name' },
  { key: 'type_label' as const, header: 'Type' },
];

export function LocationsClient({ units, sites, types }: Props) {
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const pageSize = useOptimalPageSize();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return units;
    return units.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.code.toLowerCase().includes(q) ||
        (u.site_code ?? '').toLowerCase().includes(q) ||
        (u.site_name ?? '').toLowerCase().includes(q),
    );
  }, [units, search]);

  const openEdit = useCallback((unit: Unit) => {
    setEditing(unit);
    setSheetOpen(true);
  }, []);

  const columns = useMemo(
    (): ColumnDef<Unit, unknown>[] => [
      ...(STATIC_COLS as ColumnDef<Unit, unknown>[]),
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
        <h1 className="text-xl font-semibold tracking-tight">Locations</h1>
      </header>

      <MasterShell
        title="Locations"
        search={search}
        onSearch={setSearch}
        onNew={openCreate}
        canCreate
        exportFile="locations"
        exportCols={EXPORT_COLS}
        exportRows={filtered}
      >
        {filtered.length === 0 && !search ? (
          <EmptyState
            title="No locations yet"
            description="Add site-scoped locations (e.g. Block A, Villa 6) to start recording issues."
            action={
              <Button size="sm" onClick={openCreate}>
                Add location
              </Button>
            }
          />
        ) : (
          <DataGrid
            columns={columns}
            data={filtered}
            showRowNumbers
            pagination
            pageSize={pageSize}
          />
        )}
      </MasterShell>

      <Sheet open={sheetOpen} onOpenChange={closeSheet}>
        <SheetContent side="right" className="w-full overflow-y-auto p-6 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit location' : 'New location'}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {editing ? (
              <LocationForm
                key={editing.id}
                mode="edit"
                sites={sites}
                types={types}
                defaultValues={editing}
                onSuccess={closeSheet}
              />
            ) : (
              <LocationForm
                key="create"
                mode="create"
                sites={sites}
                types={types}
                onSuccess={closeSheet}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
