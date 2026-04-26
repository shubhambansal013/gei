import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditDialog, type EditTarget } from '../edit-dialog';

// Mock the components that might use server-side stuff
vi.mock('@/components/worker-picker', () => ({
  WorkerPicker: () => <div data-testid="worker-picker">Worker Picker</div>,
}));

vi.mock('@/components/searchable-select', () => ({
  SearchableSelect: () => <div data-testid="searchable-select">Searchable Select</div>,
}));

vi.mock('../actions', () => ({
  editPurchase: vi.fn(),
  editIssue: vi.fn(),
}));

const mockUnits = [
  { id: 'NOS', label: 'NOS', category: 'COUNT' },
];

const mockWorkers = [
  { id: 'w1', code: 'W001', full_name: 'John Doe', current_site_id: 's1' },
];

describe('EditDialog', () => {
  it('renders correctly for a purchase transaction', () => {
    const target: EditTarget = {
      id: 'p1',
      type: 'PURCHASE',
      currentQty: 10,
      currentRef: 'INV-001',
      receivedUnit: 'NOS',
      convFactor: 1,
      siteId: 's1',
    };

    render(
      <EditDialog
        target={target}
        units={mockUnits}
        workers={mockWorkers}
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />
    );

    expect(screen.getByText('Edit purchase transaction')).toBeDefined();
    expect(screen.getByText('Invoice #')).toBeDefined();
    expect(screen.queryByText('Issue to')).toBeNull();
  });

  it('renders correctly for an issue transaction', () => {
    const target: EditTarget = {
      id: 'is1',
      type: 'ISSUE',
      currentQty: 5,
      currentRef: 'Old Worker',
      workerId: 'w1',
      siteId: 's1',
    };

    render(
      <EditDialog
        target={target}
        units={mockUnits}
        workers={mockWorkers}
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />
    );

    expect(screen.getByText('Edit issue transaction')).toBeDefined();
    expect(screen.getByText('Issue to')).toBeDefined();
    expect(screen.queryByText('Invoice #')).toBeNull();
    // Legacy label should be gone
    expect(screen.queryByText('Issued to (Legacy)')).toBeNull();
  });
});
