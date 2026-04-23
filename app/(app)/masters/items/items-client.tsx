'use client';
import { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { MasterShell } from '@/components/master-shell';
import { DataGrid } from '@/components/data-grid';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ItemForm } from './item-form';
import type { Database } from '@/lib/supabase/types';

type ItemRow = Database['public']['Tables']['items']['Row'];
type CategoryRow = Database['public']['Tables']['item_categories']['Row'];
type UnitRow = Database['public']['Tables']['units']['Row'];

type ItemWithCategory = ItemRow & {
  category: { label: string } | null;
};

type ExportRow = {
  code: string;
  name: string;
  category: string;
  unit: string;
  reorder_level: number | null;
};

type Props = {
  items: ItemWithCategory[];
  categories: CategoryRow[];
  units: UnitRow[];
};

export function ItemsClient({ items, categories, units }: Props) {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ItemWithCategory | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const lower = search.toLowerCase();
    return items.filter(
      (row) =>
        row.name.toLowerCase().includes(lower) || (row.code ?? '').toLowerCase().includes(lower),
    );
  }, [items, search]);

  const columns: ColumnDef<ItemWithCategory, unknown>[] = [
    {
      accessorKey: 'code',
      header: 'Code',
      cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue() ?? '')}</span>,
    },
    {
      accessorKey: 'name',
      header: 'Name',
    },
    {
      id: 'category',
      header: 'Category',
      accessorFn: (row) => row.category?.label ?? '—',
    },
    {
      accessorKey: 'unit',
      header: 'Unit',
    },
    {
      accessorKey: 'reorder_level',
      header: 'Reorder Level',
      cell: ({ getValue }) => {
        const v = getValue();
        return <span className="block text-right tabular-nums">{v != null ? String(v) : '—'}</span>;
      },
    },
  ];

  const exportCols: { key: keyof ExportRow; header: string; numFmt?: string }[] = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'category', header: 'Category' },
    { key: 'unit', header: 'Unit' },
    { key: 'reorder_level', header: 'Reorder Level', numFmt: '#,##0' },
  ];

  const exportRows: ExportRow[] = filtered.map((row) => ({
    code: row.code ?? '',
    name: row.name,
    category: row.category?.label ?? '',
    unit: row.unit,
    reorder_level: row.reorder_level,
  }));

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleSuccess = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  // Event delegation: find the <tr> ancestor of the clicked element,
  // then map its tbody row-index to the filtered data array.
  const handleTableClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const tr = (e.target as HTMLElement).closest('tbody tr');
    if (!tr) return;
    const tbody = tr.closest('tbody');
    if (!tbody) return;
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr as HTMLTableRowElement);
    const item = filtered[rowIndex];
    if (item) {
      setEditing(item);
      setDialogOpen(true);
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Items</h1>
      </header>

      <MasterShell
        title="items"
        search={search}
        onSearch={setSearch}
        onNew={openCreate}
        canCreate
        exportFile="items"
        exportCols={exportCols}
        exportRows={exportRows}
      >
        {filtered.length === 0 && !search.trim() ? (
          <EmptyState
            title="No items yet"
            description="Create your first item to start recording purchases."
            action={<Button onClick={openCreate}>+ New item</Button>}
          />
        ) : (
          <div
            onClick={handleTableClick}
            className="[&_tbody_tr:hover]:bg-muted/50 [&_tbody_tr]:cursor-pointer"
          >
            <DataGrid
              columns={columns}
              data={filtered}
              showRowNumbers
              emptyMessage="No items match your search."
            />
          </div>
        )}
      </MasterShell>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit item' : 'New item'}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <ItemForm
              mode="edit"
              item={editing}
              categories={categories}
              units={units}
              onSuccess={handleSuccess}
            />
          ) : (
            <ItemForm
              mode="create"
              categories={categories}
              units={units}
              onSuccess={handleSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
