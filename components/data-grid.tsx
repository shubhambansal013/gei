'use client';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';

type Props<T> = {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  showRowNumbers?: boolean;
  emptyMessage?: string;
};

/**
 * Excel-styled table wrapper around TanStack Table v8.
 *
 * Features:
 *   - Monospace numbers, sticky header + first column (via `.excel-grid`
 *     utility classes defined in `app/globals.css`)
 *   - Click column header to sort (ascending → descending → none)
 *   - Optional row-number gutter (`showRowNumbers`) — mimics Excel's
 *     "#" column on the far left
 *
 * The grid itself only handles rendering and sorting. Filtering,
 * pagination, and inline edit are composed by the consuming screen.
 */
export function DataGrid<T>({
  columns,
  data,
  showRowNumbers = false,
  emptyMessage = 'No rows',
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  // TanStack Table intentionally returns non-memoizable functions; the
  // react-hooks/incompatible-library rule flags it but the library owns
  // re-render scheduling.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!data.length) {
    return <div className="p-8 text-center text-sm text-gray-500">{emptyMessage}</div>;
  }

  return (
    <div className="w-full overflow-auto">
      <table className="excel-grid min-w-full border-collapse">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {showRowNumbers && <th className="row-num w-10">#</th>}
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  onClick={h.column.getToggleSortingHandler()}
                  className="cursor-pointer select-none"
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {{ asc: ' ▲', desc: ' ▼' }[h.column.getIsSorted() as string] ?? ''}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, i) => (
            <tr key={row.id}>
              {showRowNumbers && <td className="row-num">{i + 1}</td>}
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
