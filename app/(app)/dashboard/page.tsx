/**
 * Placeholder dashboard. The real KPIs (stock value, low-stock alerts,
 * top consumption, recent txns, destination pivot preview) land in
 * the Phase 2 dashboard plan — see
 * `docs/superpowers/specs/2026-04-20-gei-inventory-system-design.md` §7.3.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Dashboard</h1>
      <p className="text-sm text-gray-600">
        KPI widgets land in Phase 2. Use the sidebar for inventory, masters, and transaction entry.
      </p>
    </div>
  );
}
