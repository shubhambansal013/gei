'use client';
import { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ExportButton } from '@/components/export-button';
import { PrintButton } from '@/components/print-button';

type Col<T> = { key: keyof T; header: string; numFmt?: string };

type Props<T> = {
  title: string;
  search: string;
  onSearch: (s: string) => void;
  onNew: () => void;
  canCreate: boolean;
  exportFile: string;
  exportCols: Col<T>[];
  exportRows: T[];
  children: ReactNode;
};

/**
 * Reusable toolbar + content wrapper for every master-data screen.
 * Consumers provide a row list + a create-handler; MasterShell wires
 * up search, export (CSV + XLSX), print, and a `+ New` button gated
 * on `canCreate` (which consumers resolve via PermissionGate or a
 * direct `can()` check).
 */
export function MasterShell<T>({
  title,
  search,
  onSearch,
  onNew,
  canCreate,
  exportFile,
  exportCols,
  exportRows,
  children,
}: Props<T>) {
  return (
    <section>
      <div className="print:hide mb-3 flex flex-wrap items-center justify-between gap-2">
        <Input
          placeholder={`Search ${title}...`}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <ExportButton filename={exportFile} columns={exportCols} rows={exportRows} />
          <PrintButton />
          {canCreate && (
            <Button onClick={onNew} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              New
            </Button>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}
