'use client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download } from 'lucide-react';
import { downloadCSV } from '@/lib/exporters/csv';
import { downloadXlsx } from '@/lib/exporters/xlsx';

type Col<T> = { key: keyof T; header: string; numFmt?: string };

type Props<T> = {
  filename: string;
  sheetName?: string;
  columns: Col<T>[];
  rows: T[];
};

/**
 * Dropdown that exports the current table to CSV or XLSX. Callers pass
 * `{ filename, sheetName, columns, rows }` — everything the exporters
 * need to render the current filtered view. What-you-see-is-what-you-
 * export: pass the rendered rows, not the raw dataset.
 *
 * XLSX uses `exceljs` with a frozen header, auto-filter, and a
 * per-column `numFmt` (e.g., `#,##0.00` for currency).
 */
export function ExportButton<T>({ filename, sheetName, columns, rows }: Props<T>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        }
      />
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => downloadCSV(`${filename}.csv`, { columns, rows })}>
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            downloadXlsx(`${filename}.xlsx`, {
              sheetName: sheetName ?? 'Sheet1',
              columns,
              rows,
            })
          }
        >
          Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
