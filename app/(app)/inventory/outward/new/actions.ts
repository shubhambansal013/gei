'use server';
import { runAction } from '@/lib/actions/shared';
import { issueCreateSchema } from '@/lib/validators/issue';
import { revalidatePath } from 'next/cache';
import type { Database } from '@/lib/supabase/types';

type IssueInsert = Database['public']['Tables']['issues']['Insert'];

/**
 * Creates an issue (outward) row. The discriminated-union
 * destination in the validator maps to exactly one branch of the
 * `chk_issue_destination` DB check:
 *   - location → location_ref_id + optional party_id
 *   - party    → party_id
 *   - site     → dest_site_id
 *
 * `issue_date` defaults to today.
 */
export async function createIssue(raw: unknown) {
  const res = await runAction(issueCreateSchema, raw, async (input, sb) => {
    const payload: IssueInsert = {
      site_id: input.site_id,
      item_id: input.item_id,
      qty: input.qty,
      unit: input.unit,
      issue_date: input.issue_date ?? new Date().toISOString().slice(0, 10),
      worker_id: input.worker_id ?? null,
      issued_to_legacy: input.issued_to_legacy ?? null,
      remarks: input.remarks ?? null,
      rate: input.rate ?? null,
      location_ref_id: null,
      party_id: null,
      dest_site_id: null,
    };
    if (input.destinationKind === 'location') {
      const { data: unit, error: unitErr } = await sb
        .from('location_units')
        .select('code')
        .eq('id', input.location_unit_id)
        .single();
      if (unitErr) throw new Error(`Location unit not found: ${unitErr.message}`);

      const { data: refId, error: rpcErr } = await sb.rpc('resolve_location', {
        p_site_id: input.site_id,
        p_code: unit.code,
      });
      if (rpcErr) throw new Error(`Failed to resolve location: ${rpcErr.message}`);

      payload.location_ref_id = refId;
      payload.party_id = input.party_id ?? null;
    } else if (input.destinationKind === 'party') {
      payload.party_id = input.party_id;
    } else {
      payload.dest_site_id = input.dest_site_id;
    }
    const { data, error } = await sb.from('issues').insert(payload).select().single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) {
    revalidatePath('/inventory/transactions');
    revalidatePath('/dashboard');
  }
  return res;
}
