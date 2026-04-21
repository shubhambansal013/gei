'use client';
import { useState, useMemo, useCallback } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MasterShell } from '@/components/master-shell';
import { DataGrid } from '@/components/data-grid';
import { EmptyState } from '@/components/empty-state';
import type { Tables } from '@/lib/supabase/types';
import { SiteForm } from './site-form';

type Site = Tables<'sites'>;

type Props = {
  sites: Site[];
};

const col = createColumnHelper<Site>();

const STATIC_COLS = [
  col.accessor('code', {
    header: 'Code',
    cell: (info) => <span className="font-mono tracking-wide uppercase">{info.getValue()}</span>,
  }),
  col.accessor('name', { header: 'Name' }),
  col.accessor('type', {
    header: 'Type',
    cell: (info) => info.getValue() ?? '—',
  }),
  col.accessor('address', {
    header: 'Address',
    cell: (info) => {
      const v = info.getValue();
      if (!v) return '—';
      return (
        <span className="block max-w-xs truncate" title={v}>
          {v}
        </span>
      );
    },
  }),
];

const EXPORT_COLS = [
  { key: 'code' as keyof Site, header: 'Code' },
  { key: 'name' as keyof Site, header: 'Name' },
  { key: 'type' as keyof Site, header: 'Type' },
  { key: 'address' as keyof Site, header: 'Address' },
];

/**
 * Client side of the /masters/sites page. Handles local search,
 * the create/edit sheet, and delegates grid rendering to DataGrid
 * and toolbar to MasterShell.
 */
export function SitesClient({ sites }: Props) {
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.type ?? '').toLowerCase().includes(q),
    );
  }, [sites, search]);

  const openEdit = useCallback((site: Site) => {
    setEditing(site);
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
    (): ColumnDef<Site, unknown>[] => [
      ...(STATIC_COLS as ColumnDef<Site, unknown>[]),
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

  return (
    <>
      <MasterShell
        title="Sites"
        search={search}
        onSearch={setSearch}
        onNew={openCreate}
        canCreate
        exportFile="sites"
        exportCols={EXPORT_COLS}
        exportRows={filtered}
      >
        {filtered.length === 0 ? (
          <EmptyState
            title="No accessible sites"
            description="Ask an admin to grant you access, or create a site if you're an admin."
            action={
              <Button size="sm" onClick={openCreate}>
                + New site
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
            <SheetTitle>{editing ? 'Edit site' : 'New site'}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {editing ? (
              <SiteForm key={editing.id} mode="edit" site={editing} onSuccess={closeSheet} />
            ) : (
              <SiteForm key="create" mode="create" onSuccess={closeSheet} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
