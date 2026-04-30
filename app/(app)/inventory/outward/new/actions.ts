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
 *   - location → location_unit_id + optional party_id
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
      worker_id: input.worker_id,
      remarks: input.remarks ?? null,
      rate: input.rate ?? null,
      location_unit_id: null,
      party_id: null,
      dest_site_id: null,
    };
    if (input.destinationKind === 'location') {
      payload.location_unit_id = input.location_unit_id;
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
