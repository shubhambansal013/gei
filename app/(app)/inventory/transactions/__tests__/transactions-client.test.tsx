import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransactionsClient, type PurchaseRow, type IssueRow } from '../transactions-client';
import { type WorkerOption } from '@/components/worker-picker';

// Mock useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

// Mock the whole actions file before it's even imported by anything
vi.mock('../actions', () => ({
  softDeletePurchase: vi.fn(),
  softDeleteIssue: vi.fn(),
  editPurchase: vi.fn(),
  editIssue: vi.fn(),
}));

// Mock EditDialog to avoid importing actions or other server-side things it might touch
vi.mock('../edit-dialog', () => ({
  EditDialog: () => <div data-testid="edit-dialog" />,
}));

const mockUnits = [
  { id: 'NOS', label: 'NOS', category: 'COUNT' },
];

const mockWorkers = [
  { id: 'w1', code: 'W001', full_name: 'John Doe', current_site_id: 's1' },
];

const mockPurchases = [
  {
    id: 'p1',
    site_id: 's1',
    receipt_date: '2023-01-01',
    received_qty: 10,
    received_unit: 'NOS',
    unit_conv_factor: 1,
    stock_qty: 10,
    total_amount: 1000,
    invoice_no: 'INV-001',
    item: { id: 'i1', code: 'ITEM001', name: 'Item 1', stock_unit: 'NOS' },
    vendor: { id: 'v1', name: 'Vendor 1' },
  },
];

const mockIssues = [
  {
    id: 'is1',
    site_id: 's1',
    issue_date: '2023-01-02',
    qty: 5,
    unit: 'NOS',
    worker_id: 'w1',
    item: { id: 'i2', code: 'ITEM002', name: 'Item 2', stock_unit: 'NOS' },
    party: { id: 'p1', name: 'Party 1' },
    location: { id: 'l1', name: 'Location 1', code: 'L1' },
    dest: null,
    worker: { id: 'w1', code: 'W001', full_name: 'John Doe' },
  },
];

describe('TransactionsClient', () => {
  it('renders transactions table with correct columns', () => {
    render(
      <TransactionsClient
        purchases={mockPurchases as unknown as PurchaseRow[]}
        issues={mockIssues as unknown as IssueRow[]}
        units={mockUnits}
        workers={mockWorkers as unknown as WorkerOption[]}
      />
    );

    // Verify headers
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Item')).toBeInTheDocument();
    expect(screen.getByText('Qty')).toBeInTheDocument();
    expect(screen.getByText('Unit')).toBeInTheDocument();
    expect(screen.getByText('Party')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText('Issue to')).toBeInTheDocument();

    // Verify old "Code" and "Amount" headers are NOT present
    expect(screen.queryByText('Code')).not.toBeInTheDocument();
    expect(screen.queryByText('Amount (₹)')).not.toBeInTheDocument();

    // Verify data
    expect(screen.getByText('ITEM001')).toBeInTheDocument();
    expect(screen.getByText('ITEM002')).toBeInTheDocument();
    expect(screen.getByText('Vendor 1')).toBeInTheDocument();
    expect(screen.getByText('Party 1')).toBeInTheDocument();
    expect(screen.getByText('Location 1')).toBeInTheDocument();
  });

  it('filters rows by date range', () => {
    render(
      <TransactionsClient
        purchases={mockPurchases as unknown as PurchaseRow[]}
        issues={mockIssues as unknown as IssueRow[]}
        units={mockUnits}
        workers={mockWorkers as unknown as WorkerOption[]}
      />
    );

    // Both rows should be visible initially
    expect(screen.getByText('ITEM001')).toBeInTheDocument();
    expect(screen.getByText('ITEM002')).toBeInTheDocument();

    // Set "From" date to 2023-01-02
    const fromInput = screen.getByLabelText('From');
    fireEvent.change(fromInput, { target: { value: '2023-01-02' } });

    // Only ITEM002 should be visible (date is 2023-01-02)
    expect(screen.queryByText('ITEM001')).not.toBeInTheDocument();
    expect(screen.getByText('ITEM002')).toBeInTheDocument();

    // Set "To" date to 2023-01-01
    fireEvent.change(fromInput, { target: { value: '' } });
    const toInput = screen.getByLabelText('To');
    fireEvent.change(toInput, { target: { value: '2023-01-01' } });

    // Only ITEM001 should be visible
    expect(screen.getByText('ITEM001')).toBeInTheDocument();
    expect(screen.queryByText('ITEM002')).not.toBeInTheDocument();
  });
});
