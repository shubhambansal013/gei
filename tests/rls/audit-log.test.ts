/**
 * RLS + trigger coverage for `inventory_edit_log`:
 * - Direct client SELECT returns only rows for transactions the user
 *   can view (`can_user(..., 'INVENTORY', 'VIEW')`).
 * - UPDATE on `purchases` / `issues` flows into a log row with the
 *   reason captured from `SET LOCAL app.edit_reason` and correct
 *   before/after JSONB snapshots.
 * - Hard DELETE stays blocked.
 */
import { describe, it, expect, afterAll } from 'vitest';
import pg from 'pg';
import { asUser, service, setGlobalRole } from './helpers';

const DB_URL = process.env.DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function runInTransaction(statements: string[]) {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const sql of statements) await client.query(sql);
    await client.query('COMMIT');
  } finally {
    await client.end();
  }
}

describe('inventory_edit_log — audit trigger + RLS', () => {
  const siteCode = `RLS-AUD-${Date.now()}`;
  const itemCode = `I-${Date.now()}`;
  let siteId = '';
  let itemId = '';
  let purchaseId = '';

  afterAll(async () => {
    const svc = service();
    if (purchaseId) {
      await svc.from('inventory_edit_log').delete().eq('row_id', purchaseId);
      await svc.from('purchases').delete().eq('id', purchaseId);
    }
    if (itemId) await svc.from('items').delete().eq('id', itemId);
    if (siteId) await svc.from('sites').delete().eq('id', siteId);
  });

  it('trigger writes before/after JSONB + reason on UPDATE', async () => {
    const svc = service();
    const { data: site } = await svc
      .from('sites')
      .insert({ code: siteCode, name: 'RLS Audit QA' })
      .select()
      .single();
    siteId = site!.id;
    const { data: item } = await svc
      .from('items')
      .insert({ code: itemCode, name: 'Audit Cement', stock_unit: 'MT',
      .select()
      .single();
    itemId = item!.id;

    const { data: purchase } = await svc
      .from('purchases')
      .insert({
        site_id: siteId,
        item_id: itemId,
        received_qty: 50,
        received_unit: 'MT',
        stock_unit: 'MT',
      })
      .select()
      .single();
    purchaseId = purchase!.id;

    await runInTransaction([
      "SET LOCAL app.edit_reason = 'supplier corrected invoice'",
      `UPDATE purchases SET received_qty = 55 WHERE id = '${purchaseId}'`,
    ]);

    const { data: log } = await svc
      .from('inventory_edit_log')
      .select('reason, before_data, after_data, table_name')
      .eq('row_id', purchaseId)
      .order('changed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    expect(log).not.toBeNull();
    expect(log!.reason).toBe('supplier corrected invoice');
    expect(log!.table_name).toBe('purchases');
    expect(Number(log!.before_data.received_qty)).toBe(50);
    expect(Number(log!.after_data.received_qty)).toBe(55);
  });

  it('reason is NULL in the log when GUC is unset', async () => {
    const svc = service();
    await runInTransaction([
      // No SET LOCAL — current_setting returns '' and the trigger NULLIFs it.
      `UPDATE purchases SET remarks = 'no-reason edit' WHERE id = '${purchaseId}'`,
    ]);
    const { data: rows } = await svc
      .from('inventory_edit_log')
      .select('reason')
      .eq('row_id', purchaseId)
      .order('changed_at', { ascending: false })
      .limit(1);
    expect(rows?.[0]?.reason).toBeNull();
  });

  it('VIEWER cannot SELECT edit_log rows for sites they have no access to', async () => {
    const viewer = await asUser('rls-aud-viewer@test.local');
    const { data: who } = await viewer.auth.getUser();
    await setGlobalRole(who.user!.id, 'VIEWER');

    const { data, error } = await viewer
      .from('inventory_edit_log')
      .select('id')
      .eq('row_id', purchaseId);
    // No rows returned (RLS filters) AND no error (by design — Supabase
    // treats RLS-filtered empty selects as successful).
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('hard DELETE on purchases stays blocked even for SUPER_ADMIN', async () => {
    const admin = await asUser('rls-aud-sa@test.local');
    const { data: who } = await admin.auth.getUser();
    await setGlobalRole(who.user!.id, 'SUPER_ADMIN');

    await admin.from('purchases').delete().eq('id', purchaseId);
    const { data: still } = await service()
      .from('purchases')
      .select('id')
      .eq('id', purchaseId)
      .maybeSingle();
    expect(still?.id).toBe(purchaseId);
  });
});
