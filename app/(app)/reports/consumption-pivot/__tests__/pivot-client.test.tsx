import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PivotClient } from '../pivot-client';

// Mock components that use browser APIs or complex logic
vi.mock('@/components/export-button', () => ({
  ExportButton: () => <button>Export</button>,
}));
vi.mock('@/components/print-button', () => ({
  PrintButton: () => <button>Print</button>,
}));

const mockIssues = [
  {
    id: '1',
    qty: 100,
    issue_date: '2026-04-01',
    item: { id: 'item1', code: 'ITM1', name: 'Cement', stock_unit: 'BAG' },
    party: { id: 'party1', name: 'Supplier A', short_code: 'SUPA' },
    location: null,
    dest: null,
  },
  {
    id: '2',
    qty: 50,
    issue_date: '2026-04-02',
    item: { id: 'item1', code: 'ITM1', name: 'Cement', stock_unit: 'BAG' },
    party: null,
    location: { id: 'loc1', name: 'Block A', code: 'BLKA' },
    dest: null,
  },
];

describe('PivotClient', () => {
  it('renders the pivot table with items as rows and destinations as columns', () => {
    render(<PivotClient issues={mockIssues} />);

    // Check header
    expect(screen.getByText('Consumption Pivot')).toBeInTheDocument();

    // Check row for Cement
    expect(screen.getByText('Cement')).toBeInTheDocument();
    expect(screen.getByText('ITM1')).toBeInTheDocument();
    expect(screen.getByText('BAG')).toBeInTheDocument();

    // Check column headers (codes)
    expect(screen.getByText('SUPA')).toBeInTheDocument();
    expect(screen.getByText('BLKA')).toBeInTheDocument();

    // Check quantity cells (formatted en-IN with 2 decimal places)
    // 100.00 for Supplier A, 50.00 for Block A
    // Use getAllByText because these values appear in both data rows and total rows
    expect(screen.getAllByText('100.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('50.00').length).toBeGreaterThanOrEqual(1);

    // Check row total
    expect(screen.getAllByText('150.00').length).toBeGreaterThanOrEqual(1);
  });
});
