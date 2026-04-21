/**
 * Placeholder dashboard. The real KPIs (stock value, low-stock alerts,
 * top consumption, recent txns, destination pivot preview) land in
 * the Phase 2 dashboard plan — see
 * `docs/superpowers/specs/2026-04-20-gei-inventory-system-design.md` §7.3.
 *
 * This layout demonstrates the design tokens in practice:
 * - Mono numerals for headline stats (tabular-nums via Geist Mono)
 * - Warm neutral cards on a slightly darker muted canvas
 * - Amber primary reserved for single high-attention signals
 */
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          KPI widgets land in Phase 2. Use the sidebar for inventory, masters, and transaction
          entry.
        </p>
      </header>

      <section
        aria-label="Key metrics"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {[
          { label: 'Stock value', value: '—', sub: 'Phase 2' },
          { label: 'SKUs in stock', value: '—', sub: 'Phase 2' },
          { label: 'Inward this month', value: '—', sub: 'Phase 2' },
          { label: 'Outward this month', value: '—', sub: 'Phase 2' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card rounded-md border p-4 shadow-sm">
            <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              {kpi.label}
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{kpi.value}</div>
            <div className="text-muted-foreground mt-1 text-xs">{kpi.sub}</div>
          </div>
        ))}
      </section>

      <section className="bg-card rounded-md border p-6 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold">Next up</h2>
        <ul className="text-muted-foreground space-y-1.5 text-sm">
          <li>
            <span className="text-foreground font-medium">Masters plan</span> — items, parties,
            sites, locations CRUD. Read
            <code className="bg-muted mx-1 rounded px-1.5 py-0.5 font-mono text-xs">
              docs/superpowers/plans/2026-04-20-gei-inventory-masters.md
            </code>
            to start.
          </li>
          <li>
            <span className="text-foreground font-medium">Transactions plan</span> — inward,
            outward, list, ledger. Depends on Masters.
          </li>
          <li>
            <span className="text-foreground font-medium">Phase 2 dashboard</span> — the widgets
            above become live once Transactions lands.
          </li>
        </ul>
      </section>
    </div>
  );
}
