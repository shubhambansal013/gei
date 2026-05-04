import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PivotClient } from '../pivot-client';

type IssueRow = {
  id: string;
  qty: number;
  issue_date: string;
  item: { id: string; code: string | null; name: string; stock_unit: string } | null;
  party: { id: string; name: string } | null;
  location: { id: string; name: string; code: string } | null;
  dest: { id: string; code: string; name: string } | null;
};

const mockIssues: IssueRow[] = [
  {
    id: '1',
    qty: 10,
    issue_date: '2026-05-01',
    item: { id: 'i1', code: 'C1', name: 'Item 1', stock_unit: 'kg' },
    party: { id: 'p1', name: 'Party 1' },
    location: null,
    dest: null,
  },
  {
    id: '2',
    qty: 5,
    issue_date: '2026-05-01',
    item: { id: 'i1', code: 'C1', name: 'Item 1', stock_unit: 'kg' },
    party: null,
    location: { id: 'l1', name: 'Loc 1', code: 'LC1' },
    dest: null,
  },
  {
    id: '3',
    qty: 20,
    issue_date: '2026-05-02',
    item: { id: 'i2', code: 'C2', name: 'Item 2', stock_unit: 'pcs' },
    party: { id: 'p1', name: 'Party 1' },
    location: { id: 'l1', name: 'Loc 1', code: 'LC1' },
    dest: null,
  },
];

describe('PivotClient Transposed', () => {
  it('renders items as rows and destinations as columns', () => {
    render(<PivotClient issues={mockIssues} />);

    // Header: Destinations (Columns)
    expect(screen.getByText('Party 1')).toBeInTheDocument();
    expect(screen.getByText('Loc 1')).toBeInTheDocument();
    expect(screen.getByText('Loc 1 (Party 1)')).toBeInTheDocument();

    // Rows: Items
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();

    // Quantities (use getAllByText for non-unique totals/values if needed)
    // Item 1 Total is 15
    expect(screen.getByText('15')).toBeInTheDocument();
    // Item 2 Total is 20, and Loc 1 (Party 1) Total is also 20.
    expect(screen.getAllByText('20').length).toBeGreaterThanOrEqual(2);

    // Grand total
    expect(screen.getByText('35')).toBeInTheDocument();
  });

  it('renders empty state when no issues', () => {
    render(<PivotClient issues={[]} />);
    expect(screen.getByText('No issues yet')).toBeInTheDocument();
  });
});
