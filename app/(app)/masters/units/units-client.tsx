'use client';
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { MasterShell } from '@/components/master-shell';
import { DataGrid } from '@/components/data-grid';
import { EmptyState } from '@/components/empty-state';
import { useOptimalPageSize } from '@/lib/hooks/use-optimal-page-size';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { UnitForm } from './unit-form';
import { deleteUnit } from './actions';
import type { Database } from '@/lib/supabase/types';

type UnitRow = Database['public']['Tables']['units']['Row'];

type ExportRow = {
  id: string;
  label: string;
  category: string;
};

type Props = {
  units: UnitRow[];
};

/**
 * Units master screen. Simple list + create + edit + delete. Write
 * actions are RLS-gated to admin-anywhere; this client assumes the
 * user is allowed to see the page (route guard + pending screen) and
 * lets the server action surface authorization errors as a toast if a
 * VIEWER reaches it directly.
 */
export function UnitsClient({ units }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<UnitRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UnitRow | null>(null);
  const pageSize = useOptimalPageSize();

  const filtered = useMemo(() => {
    if (!search.trim()) return units;
    const lower = search.toLowerCase();
    return units.filter(
      (u) =>
        u.id.toLowerCase().includes(lower) ||
        u.label.toLowerCase().includes(lower) ||
        (u.category ?? '').toLowerCase().includes(lower),
    );
  }, [units, search]);

  const columns: ColumnDef<UnitRow, unknown>[] = [
    {
      accessorKey: 'id',
      header: 'Symbol',
      cell: ({ getValue }) => (
        <span className="font-mono text-xs font-semibold">{String(getValue() ?? '')}</span>
      ),
    },
    {
      accessorKey: 'label',
      header: 'Label',
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ getValue }) => {
        const v = getValue();
        return <span>{v ? String(v) : '—'}</span>;
      },
    },
  ];

  const exportCols: { key: keyof ExportRow; header: string }[] = [
    { key: 'id', header: 'Symbol' },
    { key: 'label', header: 'Label' },
    { key: 'category', header: 'Category' },
  ];

  const exportRows: ExportRow[] = filtered.map((u) => ({
    id: u.id,
    label: u.label,
    category: u.category ?? '',
  }));

  const openCreate = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const handleSuccess = () => {
    setSheetOpen(false);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await deleteUnit(deleteTarget.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Unit "${deleteTarget.id}" removed.`);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Units</h1>
        <p className="text-muted-foreground text-sm">
          Units of measure used across items, purchases, and issues.
        </p>
      </header>

      <MasterShell
        title="units"
        search={search}
        onSearch={setSearch}
        onNew={openCreate}
        canCreate
        exportFile="units"
        exportCols={exportCols}
        exportRows={exportRows}
      >
        {filtered.length === 0 && !search.trim() ? (
          <EmptyState
            title="No units yet"
            description="Create your first unit (e.g. KG for kilograms) to start."
            action={<Button onClick={openCreate}>+ New unit</Button>}
          />
        ) : (
          <DataGrid
            columns={columns}
            data={filtered}
            showRowNumbers
            pagination
            pageSize={pageSize}
            onRowClick={(unit) => {
              setEditing(unit);
              setSheetOpen(true);
            }}
            emptyMessage="No units match your search."
          />
        )}
      </MasterShell>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto p-6 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit unit' : 'New unit'}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {editing ? (
              <UnitForm
                mode="edit"
                unit={editing}
                onSuccess={handleSuccess}
                onRequestDelete={() => {
                  setDeleteTarget(editing);
                  setSheetOpen(false);
                }}
              />
            ) : (
              <UnitForm mode="create" onSuccess={handleSuccess} />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete unit "${deleteTarget?.id ?? ''}"?`}
        description="This cannot be undone. If the unit is referenced by any item or transaction, the delete will fail."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
