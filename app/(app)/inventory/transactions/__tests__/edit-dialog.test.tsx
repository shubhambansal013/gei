import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditDialog, type EditTarget } from '../edit-dialog';
import * as actions from '../actions';
import { toast } from 'sonner';

// Mock the components that might use server-side stuff
vi.mock('@/components/worker-picker', () => ({
  WorkerPicker: ({ onChange, value }: { onChange: (v: string) => void; value: string | null }) => (
    <div data-testid="worker-picker" onClick={() => onChange('w2')}>
      Worker Picker: {value}
    </div>
  ),
}));

vi.mock('@/components/searchable-select', () => ({
  SearchableSelect: ({ onChange, value }: { onChange: (v: string) => void; value: string }) => (
    <div data-testid="searchable-select" onClick={() => onChange('BAGS')}>
      Searchable Select: {value}
    </div>
  ),
}));

vi.mock('../actions', () => ({
  editPurchase: vi.fn(),
  editIssue: vi.fn(),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockUnits = [
  { id: 'NOS', label: 'NOS', category: 'COUNT' },
  { id: 'BAGS', label: 'BAGS', category: 'WEIGHT' },
];

const mockWorkers = [
  { id: 'w1', code: 'W001', full_name: 'John Doe', current_site_id: 's1' },
  { id: 'w2', code: 'W002', full_name: 'Jane Smith', current_site_id: 's1' },
];

describe('EditDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
  });

  it('calls editPurchase with updated fields', async () => {
    vi.mocked(actions.editPurchase).mockResolvedValue({ ok: true, data: {} } as never);
    const target: EditTarget = {
      id: 'p1',
      type: 'PURCHASE',
      currentQty: 10,
      currentRef: 'INV-001',
      receivedUnit: 'NOS',
      convFactor: 1,
      siteId: 's1',
    };

    const onSuccess = vi.fn();
    render(
      <EditDialog
        target={target}
        units={mockUnits}
        workers={mockWorkers}
        onOpenChange={() => {}}
        onSuccess={onSuccess}
      />
    );

    fireEvent.change(screen.getByLabelText('Received Qty'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Invoice #'), { target: { value: 'INV-002' } });
    fireEvent.change(screen.getByLabelText('Conv. Factor'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Updated all fields' } });

    // Simulate unit change
    fireEvent.click(screen.getByTestId('searchable-select'));

    fireEvent.click(screen.getByText('Save with reason'));

    await waitFor(() => {
      expect(actions.editPurchase).toHaveBeenCalledWith({
        id: 'p1',
        reason: 'Updated all fields',
        received_qty: '20',
        received_unit: 'BAGS',
        unit_conv_factor: '2',
        invoice_no: 'INV-002',
      });
      expect(toast.success).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('calls editIssue with updated fields', async () => {
    vi.mocked(actions.editIssue).mockResolvedValue({ ok: true, data: {} } as never);
    const target: EditTarget = {
      id: 'is1',
      type: 'ISSUE',
      currentQty: 5,
      currentRef: 'Old Worker',
      workerId: 'w1',
      siteId: 's1',
    };

    const onSuccess = vi.fn();
    render(
      <EditDialog
        target={target}
        units={mockUnits}
        workers={mockWorkers}
        onOpenChange={() => {}}
        onSuccess={onSuccess}
      />
    );

    fireEvent.change(screen.getByLabelText('Qty'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Updated issue fields' } });

    // Simulate worker change
    fireEvent.click(screen.getByTestId('worker-picker'));

    fireEvent.click(screen.getByText('Save with reason'));

    await waitFor(() => {
      expect(actions.editIssue).toHaveBeenCalledWith({
        id: 'is1',
        reason: 'Updated issue fields',
        qty: '7',
        worker_id: 'w2',
      });
      expect(toast.success).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('handles editPurchase failure', async () => {
    vi.mocked(actions.editPurchase).mockResolvedValue({ ok: false, error: 'Database error' } as never);
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

    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Test failure' } });
    fireEvent.click(screen.getByText('Save with reason'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Database error');
    });
  });

  it('handles editIssue exception', async () => {
    vi.mocked(actions.editIssue).mockRejectedValue(new Error('Network error'));
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

    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Test exception' } });
    fireEvent.click(screen.getByText('Save with reason'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to save changes.');
    });
  });

  it('does not send unchanged fields in payload', async () => {
    vi.mocked(actions.editPurchase).mockResolvedValue({ ok: true, data: {} } as never);
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

    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'No changes' } });
    fireEvent.click(screen.getByText('Save with reason'));

    await waitFor(() => {
      expect(actions.editPurchase).toHaveBeenCalledWith({
        id: 'p1',
        reason: 'No changes',
      });
    });
  });

  it('handles null ref for purchase', async () => {
    vi.mocked(actions.editPurchase).mockResolvedValue({ ok: true, data: {} } as never);
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

    fireEvent.change(screen.getByLabelText('Invoice #'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Clear invoice' } });
    fireEvent.click(screen.getByText('Save with reason'));

    await waitFor(() => {
      expect(actions.editPurchase).toHaveBeenCalledWith({
        id: 'p1',
        reason: 'Clear invoice',
        invoice_no: null,
      });
    });
  });
});
