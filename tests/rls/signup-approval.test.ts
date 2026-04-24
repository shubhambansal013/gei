/**
 * Security Wave 1 — Issue #12: new signups get zero access until
 * SUPER_ADMIN or ADMIN approves.
 *
 * Before this wave:
 *   - `profiles.is_active DEFAULT true`
 *   - `handle_new_user()` creates profile with role_id='VIEWER'
 *   - VIEWER has role_permissions.VIEW on every module
 *   - `items_select_all` / `parties_select_all` allowed ANY
 *     authenticated user (regardless of is_active)
 *
 * After:
 *   - `profiles.is_active DEFAULT false`
 *   - masters SELECT policies additionally require is_active=true
 *   - `can_user` already returned false when is_active=false, so
 *     transactional tables were fine on that path — this test just
 *     asserts the master-table hole is closed.
 *
 * Requires a running local Supabase (supabase start).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { asUser, service } from './helpers';

describe('signup approval — inactive profiles cannot read masters', () => {
  const uniq = `SA-${Date.now()}`;
  let itemId = '';
  let siteId = '';

  beforeAll(async () => {
    const svc = service();
    const { data: site } = await svc
      .from('sites')
      .insert({ code: `S-${uniq}`, name: 'Signup approval test' })
      .select()
      .single();
    siteId = site!.id;
    const { data: item } = await svc
      .from('items')
      .insert({ code: `I-${uniq}`, name: 'SA Item', stock_unit: 'NOS' })
      .select()
      .single();
    itemId = item!.id;
  });

  afterAll(async () => {
    const svc = service();
    await svc.from('items').delete().eq('id', itemId);
    await svc.from('sites').delete().eq('id', siteId);
  });

  it('new signup defaults to is_active=false', async () => {
    const email = `new-signup-${Date.now()}@test.local`;
    await asUser(email);
    const { data: profile } = await service()
      .from('profiles')
      .select('is_active, role_id')
      .eq(
        'id',
        (await service().auth.admin.listUsers()).data.users.find((u) => u.email === email)!.id,
      )
      .maybeSingle();
    expect(profile?.is_active).toBe(false);
    // Default role remains VIEWER — the gate is is_active, not role.
    expect(profile?.role_id).toBe('VIEWER');
  });

  it('inactive VIEWER cannot SELECT items', async () => {
    const u = await asUser('sa-inactive@test.local');
    const { data: who } = await u.auth.getUser();
    // Explicitly set inactive (clear any backfilled state).
    await service()
      .from('profiles')
      .update({ is_active: false, role_id: 'VIEWER' })
      .eq('id', who.user!.id);

    const { data } = await u.from('items').select('id').eq('id', itemId);
    expect(data ?? []).toHaveLength(0);
  });

  it('inactive VIEWER cannot SELECT parties', async () => {
    const u = await asUser('sa-inactive2@test.local');
    const { data: who } = await u.auth.getUser();
    await service()
      .from('profiles')
      .update({ is_active: false, role_id: 'VIEWER' })
      .eq('id', who.user!.id);

    const { data } = await u.from('parties').select('id');
    expect(data ?? []).toHaveLength(0);
  });

  it('active VIEWER CAN SELECT items (approval flips the gate)', async () => {
    const u = await asUser('sa-active@test.local');
    const { data: who } = await u.auth.getUser();
    await service()
      .from('profiles')
      .update({ is_active: true, role_id: 'VIEWER' })
      .eq('id', who.user!.id);

    const { data, error } = await u.from('items').select('id').eq('id', itemId);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it('inactive user cannot INSERT a purchase — can_user returns false', async () => {
    const u = await asUser('sa-inactive-txn@test.local');
    const { data: who } = await u.auth.getUser();
    await service().from('profiles').update({ is_active: false }).eq('id', who.user!.id);

    const res = await u.from('purchases').insert({
      site_id: siteId,
      item_id: itemId,
      received_qty: 1,
      received_unit: 'NOS',
      stock_unit: 'NOS',
    });
    expect(res.error).not.toBeNull();
  });

  it('approved_at and approved_by columns exist on profiles', async () => {
    const { data, error } = await service()
      .from('profiles')
      .select('id, is_active, approved_at, approved_by')
      .limit(1);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });
});
