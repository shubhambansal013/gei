import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
