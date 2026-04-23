import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ItemsReportClient, type ItemReportRow } from '../items-report-client';

const rows: ItemReportRow[] = [
  {
    itemId: 'i-1',
    code: 'CMT-001',
    name: 'Portland Cement',
    unit: 'bag',
    purchased: 1000,
    issued: 600,
    current: 400,
    value: 120000,
  },
  {
    itemId: 'i-2',
    code: 'RBR-002',
    name: 'Rebar 12mm',
    unit: 'kg',
    purchased: 5000,
    issued: 2500,
    current: 2500,
    value: null,
  },
];

describe('ItemsReportClient', () => {
  it('renders a grid with one row per item and the expected columns', () => {
    render(<ItemsReportClient rows={rows} />);

    // Headers
    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Stock unit')).toBeInTheDocument();
    expect(screen.getByText('Total purchased')).toBeInTheDocument();
    expect(screen.getByText('Total issued')).toBeInTheDocument();
    expect(screen.getByText('Current stock')).toBeInTheDocument();
    expect(screen.getByText('Value (₹)')).toBeInTheDocument();

    // Item cells
    expect(screen.getByText('CMT-001')).toBeInTheDocument();
    expect(screen.getByText('Portland Cement')).toBeInTheDocument();
    expect(screen.getByText('RBR-002')).toBeInTheDocument();
    expect(screen.getByText('Rebar 12mm')).toBeInTheDocument();

    // Null value renders as dash
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders the empty state when rows is empty', () => {
    render(<ItemsReportClient rows={[]} />);
    expect(screen.getByText('No stock movements yet')).toBeInTheDocument();
    // No data-grid rendered: no row-number gutter present
    expect(screen.queryByText('#')).not.toBeInTheDocument();
  });
});
