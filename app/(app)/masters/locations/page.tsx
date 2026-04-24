export const runtime = "edge";
import { supabaseServer } from '@/lib/supabase/server';
import { LocationsClient } from './locations-client';

export const dynamic = 'force-dynamic';

export default async function LocationsPage() {
  const sb = await supabaseServer();
  const [{ data: units }, { data: sites }, { data: types }] = await Promise.all([
    sb
      .from('location_units')
      .select(
        'id, site_id, name, code, type, site:sites(code, name), type_row:location_types!location_units_type_fkey(label)',
      )
      .order('code'),
    sb.from('sites').select('id, code, name').order('code'),
    sb.from('location_types').select('id, label').order('label'),
  ]);

  const flattenedUnits = (units ?? []).map((u) => ({
    id: u.id,
    site_id: u.site_id,
    name: u.name,
    code: u.code,
    type: u.type,
    site_code: u.site?.code ?? null,
    site_name: u.site?.name ?? null,
    type_label: u.type_row?.label ?? null,
  }));

  return (
    <LocationsClient
      units={flattenedUnits}
      sites={sites ?? []}
      types={types ?? []}
    />
  );
}
