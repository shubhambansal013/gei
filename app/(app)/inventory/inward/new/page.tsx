import { ComingSoon } from '@/components/coming-soon';

export default function InwardNewPlaceholder() {
  return (
    <ComingSoon
      title="Inward entry"
      plan="Transactions plan"
      planPath="docs/superpowers/plans/2026-04-20-gei-inventory-transactions.md"
      description="Goods-received form. Two modes: simple (5 fields for clerks) and detailed (all purchase columns for managers)."
      features={[
        'Simple mode: item, qty, unit, supplier, invoice# — 5 fields, big tap targets',
        'Detailed mode toggle adds rate, received_unit vs stock_unit + conv factor, HSN, manufacturer, part#, dates',
        'SearchableSelect for item and supplier (cmdk typeahead) with recent picks pinned',
        'Writes to purchases; generated columns stock_qty and total_amount populate automatically',
        'Optimistic UI with rollback on server error; toast on success',
      ]}
    />
  );
}
