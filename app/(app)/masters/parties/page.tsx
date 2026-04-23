import { supabaseServer } from '@/lib/supabase/server';
import { PartiesClient } from './parties-client';

/**
 * Server Component — fetches parties + party_types in parallel and
 * hands them to the client shell. Keeps all data-fetching server-side
 * so the page is pre-rendered and RLS is enforced via the user JWT.
 */
export default async function PartiesPage() {
  const sb = await supabaseServer();

  const [{ data: parties }, { data: partyTypes }] = await Promise.all([
    sb
      .from('parties')
      .select('id, name, type, short_code, type_label:party_types(label), gstin, phone, address')
      .order('name'),
    sb.from('party_types').select('id, label').order('label'),
  ]);

  // Normalise the joined `type_label` from Supabase's shape
  // `{ label: string } | null` → `string | null` for the client prop.
  const normalisedParties = (parties ?? []).map((p) => ({
    ...p,
    type_label:
      p.type_label && typeof p.type_label === 'object' && 'label' in p.type_label
        ? (p.type_label as { label: string }).label
        : null,
  }));

  return <PartiesClient parties={normalisedParties} partyTypes={partyTypes ?? []} />;
}
