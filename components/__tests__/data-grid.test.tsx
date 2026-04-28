import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataGrid } from '../data-grid';

type Row = { name: string; qty: number };

const cols: ColumnDef<Row, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'qty', header: 'Qty' },
];
const rows: Row[] = [
  { name: 'Cement', qty: 100 },
  { name: 'Rebar', qty: 50 },
];

describe('DataGrid', () => {
  it('renders headers and rows', () => {
    render(<DataGrid columns={cols} data={rows} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Cement')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('renders the row-number gutter when showRowNumbers', () => {
    render(<DataGrid columns={cols} data={rows} showRowNumbers />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(<DataGrid columns={cols} data={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('calls onRowClick when a row is clicked', () => {
    const onRowClick = vi.fn();
    render(<DataGrid columns={cols} data={rows} onRowClick={onRowClick} />);

    const row = screen.getByText('Cement').closest('tr');
    fireEvent.click(row!);

    expect(onRowClick).toHaveBeenCalledWith(rows[0], 0);
  });

  it('supports pagination', () => {
    const manyRows = Array.from({ length: 11 }, (_, i) => ({ name: `Item ${i}`, qty: i }));
    render(<DataGrid columns={cols} data={manyRows} pagination pageSize={10} />);

    // First page should have Item 0 to Item 9
    expect(screen.getByText('Item 0')).toBeInTheDocument();
    expect(screen.getByText('Item 9')).toBeInTheDocument();
    expect(screen.queryByText('Item 10')).not.toBeInTheDocument();

    // Should show page info
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    // Go to next page
    const nextButton = screen.getByRole('button', { name: /next page/i });
    fireEvent.click(nextButton);

    // Second page should have Item 10
    expect(screen.getByText('Item 10')).toBeInTheDocument();
    expect(screen.queryByText('Item 0')).not.toBeInTheDocument();
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });
});
