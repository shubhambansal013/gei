import { ComingSoon } from '@/components/coming-soon';

export default function LocationsPlaceholder() {
  return (
    <ComingSoon
      title="Locations"
      plan="Masters plan (Task 5)"
      planPath="docs/superpowers/plans/2026-04-20-gei-inventory-masters.md"
      description="Three-panel editor for the template → unit → reference hierarchy. The deepest master-data screen; shipped last because of the tree UI."
      features={[
        'Templates panel: CRUD on location_templates + a tree editor for location_template_nodes (parent-child, drag to reorder)',
        'Units panel: per-site list of location_units; + New Unit picks a template, or seed N units from a template at once',
        'References panel (read-only Phase 1): lists resolved full_path + full_code; auto-populated on first use by resolve_location()',
        'Integration tests verify resolve_location("A-1-101") returns the right node',
      ]}
    />
  );
}
