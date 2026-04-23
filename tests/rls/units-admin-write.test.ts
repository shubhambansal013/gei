/**
 * RLS — `units` master table.
 *
 * Policy contract:
 *   - SELECT: any authenticated user (units are reference data shown
 *     in every form's unit dropdown).
 *   - INSERT/UPDATE/DELETE: admin-anywhere only, same rule as the other
 *     masters (`items`, `parties`, `sites`). Matches the business
 *     intent that only admins curate reference data.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { asUser, service, setGlobalRole } from './helpers';

const TEST_IDS = ['RLS_UNIT_OK', 'RLS_UNIT_VIEWER', 'RLS_UNIT_SM'] as const;

async function cleanupUnits() {
  await service()
    .from('units')
    .delete()
    .in('id', TEST_IDS as unknown as string[]);
}

describe('units RLS', () => {
  afterAll(async () => {
    await cleanupUnits();
  });

  it('VIEWER cannot insert a unit', async () => {
    const viewer = await asUser('rls-units-viewer@test.local');
    const { data: who } = await viewer.auth.getUser();
    await setGlobalRole(who.user!.id, 'VIEWER');

    const { error } = await viewer.from('units').insert({
      id: 'RLS_UNIT_VIEWER',
      label: 'Should not insert',
      category: 'count',
    });
    expect(error).not.toBeNull();
  });

  it('STORE_MANAGER (global) cannot insert a unit', async () => {
    const sm = await asUser('rls-units-sm@test.local');
    const { data: who } = await sm.auth.getUser();
    await setGlobalRole(who.user!.id, 'STORE_MANAGER');

    const { error } = await sm.from('units').insert({
      id: 'RLS_UNIT_SM',
      label: 'Still denied',
      category: 'count',
    });
    expect(error).not.toBeNull();
  });

  it('SUPER_ADMIN can insert, update, and delete a unit', async () => {
    const admin = await asUser('rls-units-sa@test.local');
    const { data: who } = await admin.auth.getUser();
    await setGlobalRole(who.user!.id, 'SUPER_ADMIN');

    const insertRes = await admin.from('units').insert({
      id: 'RLS_UNIT_OK',
      label: 'Test Unit',
      category: 'count',
    });
    expect(insertRes.error).toBeNull();

    const updateRes = await admin
      .from('units')
      .update({ label: 'Test Unit v2' })
      .eq('id', 'RLS_UNIT_OK');
    expect(updateRes.error).toBeNull();

    const deleteRes = await admin.from('units').delete().eq('id', 'RLS_UNIT_OK');
    expect(deleteRes.error).toBeNull();

    const { data: check } = await service()
      .from('units')
      .select('id')
      .eq('id', 'RLS_UNIT_OK')
      .maybeSingle();
    expect(check).toBeNull();
  });

  it('any authenticated user can SELECT units', async () => {
    const viewer = await asUser('rls-units-select@test.local');
    const { data: who } = await viewer.auth.getUser();
    await setGlobalRole(who.user!.id, 'VIEWER');

    const { data, error } = await viewer.from('units').select('id, label').limit(1);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });
});
