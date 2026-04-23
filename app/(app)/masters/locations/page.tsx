import { supabaseServer } from '@/lib/supabase/server';
import { LocationsClient } from './locations-client';

export const dynamic = 'force-dynamic';

/**
 * Locations master. Phase 1 ships a simplified two-panel editor:
 *   - Templates: flat list of location_templates + their nodes
 *   - Units: per-site location_units bound to a template
 *
 * The full tree editor (drag-reorder nodes, drill-down) comes in a
 * follow-up plan. References are auto-populated by resolve_location()
 * on first use and are read-only in this UI.
 */
export default async function LocationsPage() {
  const sb = await supabaseServer();
  const [{ data: templates }, { data: nodes }, { data: units }, { data: sites }, { data: types }] =
    await Promise.all([
      sb.from('location_templates').select('id, name, description').order('name'),
      sb
        .from('location_template_nodes')
        .select('id, template_id, parent_id, name, code, type, position')
        .order('position', { nullsFirst: false }),
      sb
        .from('location_units')
        .select(
          'id, site_id, name, code, type, template_id, site:sites(id, code, name), template:location_templates(id, name)',
        )
        .order('code'),
      sb.from('sites').select('id, code, name').order('code'),
      sb.from('location_types').select('id, label').order('label'),
    ]);

  return (
    <LocationsClient
      templates={templates ?? []}
      nodes={nodes ?? []}
      units={units ?? []}
      sites={sites ?? []}
      types={types ?? []}
    />
  );
}
