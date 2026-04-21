import { ComingSoon } from '@/components/coming-soon';

export default function OutwardNewPlaceholder() {
  return (
    <ComingSoon
      title="Outward entry"
      plan="Transactions plan"
      planPath="docs/superpowers/plans/2026-04-20-gei-inventory-transactions.md"
      description="The core low-effort screen for site-store workers. Ruthlessly minimal: 4 fields."
      features={[
        'Field 1 — Item (SearchableSelect, recent picks pinned)',
        'Field 2 — Qty (big numeric input, tabular-nums)',
        'Field 3 — Destination (one combined SearchableSelect grouped by type: Locations · Parties · Sites)',
        'Field 4 — Issued-to (free text, optional)',
        'Discriminated-union destination maps exactly to the chk_issue_destination CHECK constraint',
        'Optional "more" expander reveals remarks + rate (managers only)',
      ]}
    />
  );
}
