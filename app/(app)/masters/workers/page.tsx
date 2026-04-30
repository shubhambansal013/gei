export const dynamic = "force-dynamic";

import { supabaseServer } from '@/lib/supabase/server';
import { WorkersClient } from './workers-client';

type WorkerJoin = {
  id: string;
  code: string;
  full_name: string;
  phone: string | null;
  home_city: string | null;
  is_active: boolean;
  current_site_id: string;
  site: { code: string; name: string } | null;
  worker_affiliations: {
    employment_type: string;
    effective_to: string | null;
    contractor: { name: string } | null;
  }[];
};

/**
 * /masters/workers — list + create + edit + transfer + change-affiliation.
 *
 * The page pulls each worker's current site (via `sites(code,name)`) and
 * their current open affiliation + contractor-party name via
 * `worker_affiliations` join. The client then flattens those into flat
 * columns the DataGrid and export writer can consume.
 */
export default async function WorkersPage() {
  const sb = await supabaseServer();

  const [workersResult, sitesResult, partiesResult] = await Promise.all([
    sb
      .from('workers')
      .select(
        `
        id, code, full_name, phone, home_city, is_active, current_site_id,
        site:sites!workers_current_site_id_fkey(code, name),
        worker_affiliations(
          employment_type,
          effective_to,
          contractor:parties!worker_affiliations_contractor_party_id_fkey(name)
        )
        `,
      )
      .order('code'),
    sb.from('sites').select('id, name, code').order('code'),
    sb
      .from('parties')
      .select('id, name, short_code, type')
      .in('type', ['CONTRACTOR', 'SUBCONTRACTOR'])
      .order('name'),
  ]);

  if (workersResult.error) throw new Error(workersResult.error.message);

  const flattened = ((workersResult.data ?? []) as unknown as WorkerJoin[]).map((w) => {
    const open = w.worker_affiliations.find((a) => a.effective_to === null);
    return {
      id: w.id,
      code: w.code,
      full_name: w.full_name,
      phone: w.phone,
      home_city: w.home_city,
      is_active: w.is_active,
      current_site_id: w.current_site_id,
      site_code: w.site?.code ?? null,
      site_name: w.site?.name ?? null,
      employment_type: open?.employment_type ?? null,
      contractor_name: open?.contractor?.name ?? null,
    };
  });

  return (
    <WorkersClient
      workers={flattened}
      sites={sitesResult.data ?? []}
      parties={partiesResult.data ?? []}
    />
  );
}
