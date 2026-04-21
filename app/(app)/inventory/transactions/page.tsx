import { ComingSoon } from '@/components/coming-soon';

export default function TransactionsPlaceholder() {
  return (
    <ComingSoon
      title="Transactions"
      plan="Transactions plan"
      planPath="docs/superpowers/plans/2026-04-20-gei-inventory-transactions.md"
      description="Unified paginated view of every inward + outward movement on the current site."
      features={[
        'Paginated table (50 rows/page, 25/50/100 options) with Excel styling',
        'Filters: date range, item, party, type (IN/OUT), text search',
        'Columns: # · Date · Type · Item · Qty · Unit · Party/Location · Issued-to · By · Amount',
        'Inline edit for INVENTORY.EDIT roles (double-click cell → reason-capture dialog → server action sets SET LOCAL app.edit_reason)',
        'Soft-delete with required reason (RLS blocks hard DELETE via policy)',
        'Export (CSV + XLSX) and browser print respect current filters',
      ]}
    />
  );
}
