import { ComingSoon } from '@/components/coming-soon';

export default function PivotPlaceholder() {
  return (
    <ComingSoon
      title="Destination × Item pivot"
      plan="Transactions plan"
      planPath="docs/superpowers/plans/2026-04-20-gei-inventory-transactions.md"
      description="Matrix view: rows are destinations (locations + parties + external sites), columns are items, cells are SUM(qty) over a date range."
      features={[
        'Date-range filter + item-category filter above the matrix',
        'Full-bleed Excel styling (no cards) — sharp cells, tabular-nums',
        'Totals row at bottom, totals column on the right',
        'Export (XLSX) mirrors the pivot exactly; browser print fits-to-page',
        'Backing query: a single SQL view grouping issues by (destination, item)',
      ]}
    />
  );
}
