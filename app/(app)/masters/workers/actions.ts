'use server';
import { runAction } from '@/lib/actions/shared';
import { ActionError } from '@/lib/actions/errors';
import {
  workerCreateSchema,
  workerUpdateSchema,
  workerTransferSchema,
  workerAffiliationChangeSchema,
} from '@/lib/validators/worker';
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/types';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Worker aggregate server actions.
 *
 * These are domain behaviours, not anemic CRUD. Every action either
 * opens history rows or closes+opens pairs atomically so the
 * single-open-assignment / single-open-affiliation invariants hold.
 *
 * We cannot run Postgres DO blocks from the JS client, so
 * "atomic" here means "the later write is conditional on the earlier
 * one" + "the earlier write is ordered first". The DB EXCLUDE constraint
 * catches any overlap that slips through — server-side compensating
 * rollback is performed on failure of the second step.
 */

type WorkerInsert = TablesInsert<'workers'>;
type WsaInsert = TablesInsert<'worker_site_assignments'>;
type AffInsert = TablesInsert<'worker_affiliations'>;

const WORKERS_PATH = '/masters/workers';

/**
 * Creates a Worker and opens the first SiteAssignment + Affiliation.
 */
export async function createWorker(raw: unknown) {
  const res = await runAction(workerCreateSchema, raw, async (input, sb) => {
    const today = new Date().toISOString().slice(0, 10);

    // 1. Insert the worker (code minted by trigger).
    const worker = await insertWorkerRecord(sb, {
      full_name: input.full_name,
      current_site_id: input.current_site_id,
      phone: input.phone ?? null,
      home_city: input.home_city ?? null,
      code: 'W-0000', // Dummy
    });

    // 2. Open the first site assignment.
    try {
      await insertSiteAssignment(sb, {
        worker_id: worker.id,
        site_id: input.current_site_id,
        effective_from: today,
        reason: 'Initial placement',
      });
    } catch (err) {
      await deactivateWorker(sb, worker.id);
      throw err;
    }

    // 3. Open the first affiliation.
    try {
      await insertAffiliation(sb, {
        worker_id: worker.id,
        employment_type: input.employment_type,
        contractor_party_id:
          input.employment_type === 'DIRECT' ? null : (input.contractor_party_id ?? null),
        effective_from: today,
      });
    } catch (err) {
      await deactivateWorker(sb, worker.id);
      throw err;
    }

    return worker;
  });

  if (res.ok) revalidatePath(WORKERS_PATH);
  return res;
}

/**
 * Edits the Worker's own fields (name/phone/city/is_active).
 */
export async function updateWorker(raw: unknown) {
  const res = await runAction(workerUpdateSchema, raw, async ({ id, ...rest }, sb) => {
    const patch: TablesUpdate<'workers'> = {
      ...(rest.full_name !== undefined && { full_name: rest.full_name }),
      ...(rest.phone !== undefined && { phone: rest.phone ?? null }),
      ...(rest.home_city !== undefined && { home_city: rest.home_city ?? null }),
      ...(rest.is_active !== undefined && { is_active: rest.is_active }),
    };

    const { data, error } = await sb.from('workers').update(patch).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  });

  if (res.ok) revalidatePath(WORKERS_PATH);
  return res;
}

/**
 * Atomically closes the current open site assignment and opens a new one.
 */
export async function transferWorker(raw: unknown) {
  const res = await runAction(workerTransferSchema, raw, async (input, sb) => {
    const open = await findOpenAssignment(sb, input.worker_id);

    validateTransfer(open, input);

    // Close current
    await closeOpenAssignment(sb, open.id, input.effective_from);

    // Open new
    try {
      await insertSiteAssignment(sb, {
        worker_id: input.worker_id,
        site_id: input.to_site_id,
        effective_from: input.effective_from,
        reason: input.reason,
      });
    } catch (err) {
      await reopenAssignment(sb, open.id);
      throw err;
    }

    // Update worker's current site
    const { error: uerr } = await sb
      .from('workers')
      .update({ current_site_id: input.to_site_id })
      .eq('id', input.worker_id);
    if (uerr) throw new Error(uerr.message);

    return { worker_id: input.worker_id, to_site_id: input.to_site_id };
  });

  if (res.ok) revalidatePath(WORKERS_PATH);
  return res;
}

/**
 * Atomically closes the current open affiliation and opens a new one.
 */
export async function changeAffiliation(raw: unknown) {
  const res = await runAction(workerAffiliationChangeSchema, raw, async (input, sb) => {
    const open = await findOpenAffiliation(sb, input.worker_id);

    validateAffiliationChange(open, input);

    // Close current
    await closeOpenAffiliation(sb, open.id, input.effective_from);

    // Open new
    try {
      await insertAffiliation(sb, {
        worker_id: input.worker_id,
        employment_type: input.employment_type,
        contractor_party_id:
          input.employment_type === 'DIRECT' ? null : (input.contractor_party_id ?? null),
        effective_from: input.effective_from,
      });
    } catch (err) {
      await reopenAffiliation(sb, open.id);
      throw err;
    }

    return { worker_id: input.worker_id };
  });

  if (res.ok) revalidatePath(WORKERS_PATH);
  return res;
}

// --- Internal Helpers ---

async function insertWorkerRecord(sb: SupabaseClient, row: WorkerInsert) {
  const { data, error } = await sb.from('workers').insert(row).select().single();
  if (error || !data) throw new Error(error?.message ?? 'Worker insert failed');
  return data;
}

async function insertSiteAssignment(sb: SupabaseClient, row: WsaInsert) {
  const { error } = await sb.from('worker_site_assignments').insert(row);
  if (error) throw new Error(error.message);
}

async function insertAffiliation(sb: SupabaseClient, row: AffInsert) {
  const { error } = await sb.from('worker_affiliations').insert(row);
  if (error) throw new Error(error.message);
}

async function deactivateWorker(sb: SupabaseClient, id: string) {
  await sb.from('workers').update({ is_active: false }).eq('id', id);
}

async function findOpenAssignment(sb: SupabaseClient, workerId: string) {
  const { data, error } = await sb
    .from('worker_site_assignments')
    .select('id, site_id, effective_from')
    .eq('worker_id', workerId)
    .is('effective_to', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('No open assignment to transfer from');
  return data;
}

function validateTransfer(
  open: { site_id: string; effective_from: string },
  input: { to_site_id: string; effective_from: string },
) {
  if (open.site_id === input.to_site_id) {
    throw new ActionError('Destination site is the same as the current site');
  }
  if (input.effective_from <= open.effective_from) {
    throw new ActionError('New effective_from must be after current placement start');
  }
}

async function closeOpenAssignment(sb: SupabaseClient, id: string, effectiveTo: string) {
  const { error } = await sb
    .from('worker_site_assignments')
    .update({ effective_to: effectiveTo })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

async function reopenAssignment(sb: SupabaseClient, id: string) {
  await sb.from('worker_site_assignments').update({ effective_to: null }).eq('id', id);
}

async function findOpenAffiliation(sb: SupabaseClient, workerId: string) {
  const { data, error } = await sb
    .from('worker_affiliations')
    .select('id, employment_type, contractor_party_id, effective_from')
    .eq('worker_id', workerId)
    .is('effective_to', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('No open affiliation to change from');
  return data;
}

function validateAffiliationChange(
  open: { employment_type: string; contractor_party_id: string | null; effective_from: string },
  input: {
    employment_type: string;
    contractor_party_id?: string | null | undefined;
    effective_from: string;
  },
) {
  if (input.effective_from <= open.effective_from) {
    throw new ActionError('New effective_from must be after current affiliation start');
  }
  if (
    open.employment_type === input.employment_type &&
    (open.contractor_party_id ?? null) === (input.contractor_party_id ?? null)
  ) {
    throw new ActionError('New affiliation is identical to the current one');
  }
}

async function closeOpenAffiliation(sb: SupabaseClient, id: string, effectiveTo: string) {
  const { error } = await sb
    .from('worker_affiliations')
    .update({ effective_to: effectiveTo })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

async function reopenAffiliation(sb: SupabaseClient, id: string) {
  await sb.from('worker_affiliations').update({ effective_to: null }).eq('id', id);
}
