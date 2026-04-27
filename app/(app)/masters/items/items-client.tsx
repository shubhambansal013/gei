'use client';
import { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { MasterShell } from '@/components/master-shell';
import { DataGrid } from '@/components/data-grid';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
  stock_unit: string;
  reorder_level: number | null;
};

type Props = {
  items: ItemWithCategory[];
  categories: CategoryRow[];
  units: UnitRow[];
};

export function ItemsClient({ items, categories, units }: Props) {
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
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
      accessorKey: 'stock_unit',
      header: 'Stock unit',
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
    { key: 'stock_unit', header: 'Stock unit' },
    { key: 'reorder_level', header: 'Reorder Level', numFmt: '#,##0' },
  ];

  const exportRows: ExportRow[] = filtered.map((row) => ({
    code: row.code ?? '',
    name: row.name,
    category: row.category?.label ?? '',
    stock_unit: row.stock_unit,
    reorder_level: row.reorder_level,
  }));

  const openCreate = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const handleSuccess = () => {
    setSheetOpen(false);
    setEditing(null);
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
          <DataGrid
            columns={columns}
            data={filtered}
            showRowNumbers
            pagination
            pageSize={50}
            onRowClick={(item) => {
              setEditing(item);
              setSheetOpen(true);
            }}
            emptyMessage="No items match your search."
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
            <SheetTitle>{editing ? 'Edit item' : 'New item'}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
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
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
