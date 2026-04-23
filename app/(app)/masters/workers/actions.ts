'use server';
import { runAction } from '@/lib/actions/shared';
import {
  workerCreateSchema,
  workerUpdateSchema,
  workerTransferSchema,
  workerAffiliationChangeSchema,
} from '@/lib/validators/worker';
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/types';
import { revalidatePath } from 'next/cache';

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
type WsaUpdate = TablesUpdate<'worker_site_assignments'>;
type AffInsert = TablesInsert<'worker_affiliations'>;
type AffUpdate = TablesUpdate<'worker_affiliations'>;

/** Creates a Worker and opens the first SiteAssignment + Affiliation. */
export async function createWorker(raw: unknown) {
  const res = await runAction(workerCreateSchema, raw, async (input, sb) => {
    const today = new Date().toISOString().slice(0, 10);

    // 1. Insert the worker (code minted by trigger).
    const workerRow: WorkerInsert = {
      full_name: input.full_name,
      current_site_id: input.current_site_id,
      phone: input.phone ?? null,
      home_city: input.home_city ?? null,
      // code is required in Insert type but the DB trigger overwrites;
      // supply a dummy that passes the CHECK so the INSERT is valid.
      code: 'W-0000',
    };
    const { data: worker, error: werr } = await sb
      .from('workers')
      .insert(workerRow)
      .select()
      .single();
    if (werr || !worker) throw new Error(werr?.message ?? 'Worker insert failed');

    // 2. Open the first site assignment.
    const wsa: WsaInsert = {
      worker_id: worker.id,
      site_id: input.current_site_id,
      effective_from: today,
      reason: 'Initial placement',
    };
    const { error: aerr } = await sb.from('worker_site_assignments').insert(wsa);
    if (aerr) {
      // Compensating rollback — delete the orphaned worker row. The
      // worker has no history yet so this is safe. Uses the user's
      // JWT so RLS still applies, but the user just inserted it so
      // the UPDATE / DELETE should succeed. If it doesn't, surface the
      // original error — an orphan worker with no assignment is an
      // anomaly the support process will find via the integrity view.
      // Note: the table has a hard-delete-deny policy; we flip
      // is_active instead so the row is at least quarantined.
      await sb.from('workers').update({ is_active: false }).eq('id', worker.id);
      throw new Error(aerr.message);
    }

    // 3. Open the first affiliation.
    const aff: AffInsert = {
      worker_id: worker.id,
      employment_type: input.employment_type,
      contractor_party_id:
        input.employment_type === 'DIRECT' ? null : (input.contractor_party_id ?? null),
      effective_from: today,
    };
    const { error: ferr } = await sb.from('worker_affiliations').insert(aff);
    if (ferr) {
      await sb.from('workers').update({ is_active: false }).eq('id', worker.id);
      throw new Error(ferr.message);
    }

    return worker;
  });
  if (res.ok) revalidatePath('/masters/workers');
  return res;
}

/**
 * Edits the Worker's own fields (name/phone/city/is_active).
 * Structural changes (site, employment type) flow through
 * `transferWorker` / `changeAffiliation`.
 */
export async function updateWorker(raw: unknown) {
  const res = await runAction(workerUpdateSchema, raw, async ({ id, ...rest }, sb) => {
    const patch: TablesUpdate<'workers'> = {
      ...(rest.full_name !== undefined ? { full_name: rest.full_name } : {}),
      ...(rest.phone !== undefined ? { phone: rest.phone ?? null } : {}),
      ...(rest.home_city !== undefined ? { home_city: rest.home_city ?? null } : {}),
      ...(rest.is_active !== undefined ? { is_active: rest.is_active } : {}),
    };
    const { data, error } = await sb.from('workers').update(patch).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/masters/workers');
  return res;
}

/**
 * Atomically closes the current open site assignment and opens a new
 * one at `to_site_id`, then repoints `workers.current_site_id`.
 *
 * Order matters: we close first so the EXCLUDE constraint does not
 * see two overlapping open ranges momentarily.
 */
export async function transferWorker(raw: unknown) {
  const res = await runAction(workerTransferSchema, raw, async (input, sb) => {
    // 1. Find the open assignment.
    const { data: open, error: oerr } = await sb
      .from('worker_site_assignments')
      .select('id, site_id, effective_from')
      .eq('worker_id', input.worker_id)
      .is('effective_to', null)
      .maybeSingle();
    if (oerr) throw new Error(oerr.message);
    if (!open) throw new Error('No open assignment to transfer from');
    if (open.site_id === input.to_site_id) {
      throw new Error('Destination site is the same as the current site');
    }
    if (input.effective_from <= open.effective_from) {
      throw new Error('New effective_from must be after current placement start');
    }

    // 2. Close the open assignment at effective_from.
    const closePatch: WsaUpdate = { effective_to: input.effective_from };
    const { error: cerr } = await sb
      .from('worker_site_assignments')
      .update(closePatch)
      .eq('id', open.id);
    if (cerr) throw new Error(cerr.message);

    // 3. Open the new assignment.
    const next: WsaInsert = {
      worker_id: input.worker_id,
      site_id: input.to_site_id,
      effective_from: input.effective_from,
      reason: input.reason,
    };
    const { error: ierr } = await sb.from('worker_site_assignments').insert(next);
    if (ierr) {
      // Compensating rollback — reopen the previous row.
      await sb.from('worker_site_assignments').update({ effective_to: null }).eq('id', open.id);
      throw new Error(ierr.message);
    }

    // 4. Repoint the worker's current site.
    const { error: uerr } = await sb
      .from('workers')
      .update({ current_site_id: input.to_site_id })
      .eq('id', input.worker_id);
    if (uerr) throw new Error(uerr.message);

    return { worker_id: input.worker_id, to_site_id: input.to_site_id };
  });
  if (res.ok) revalidatePath('/masters/workers');
  return res;
}

/**
 * Atomically closes the current open affiliation and opens a new one.
 * Use-case: a SUBCONTRACTOR_LENT worker is hired DIRECT.
 */
export async function changeAffiliation(raw: unknown) {
  const res = await runAction(workerAffiliationChangeSchema, raw, async (input, sb) => {
    const { data: open, error: oerr } = await sb
      .from('worker_affiliations')
      .select('id, employment_type, contractor_party_id, effective_from')
      .eq('worker_id', input.worker_id)
      .is('effective_to', null)
      .maybeSingle();
    if (oerr) throw new Error(oerr.message);
    if (!open) throw new Error('No open affiliation to change from');
    if (input.effective_from <= open.effective_from) {
      throw new Error('New effective_from must be after current affiliation start');
    }
    if (
      open.employment_type === input.employment_type &&
      (open.contractor_party_id ?? null) === (input.contractor_party_id ?? null)
    ) {
      throw new Error('New affiliation is identical to the current one');
    }

    const closePatch: AffUpdate = { effective_to: input.effective_from };
    const { error: cerr } = await sb
      .from('worker_affiliations')
      .update(closePatch)
      .eq('id', open.id);
    if (cerr) throw new Error(cerr.message);

    const next: AffInsert = {
      worker_id: input.worker_id,
      employment_type: input.employment_type,
      contractor_party_id:
        input.employment_type === 'DIRECT' ? null : (input.contractor_party_id ?? null),
      effective_from: input.effective_from,
    };
    const { error: ierr } = await sb.from('worker_affiliations').insert(next);
    if (ierr) {
      await sb.from('worker_affiliations').update({ effective_to: null }).eq('id', open.id);
      throw new Error(ierr.message);
    }

    return { worker_id: input.worker_id };
  });
  if (res.ok) revalidatePath('/masters/workers');
  return res;
}
