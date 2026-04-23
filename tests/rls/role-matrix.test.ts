/**
 * Role × write-permission matrix. Exercises every distinct cell from
 * `docs/permissions.md` that involves a master table write so role
 * drift (e.g. accidentally granting STORE_MANAGER items.INSERT)
 * fails loudly.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { asUser, service, setGlobalRole } from './helpers';

describe('role matrix — masters writes', () => {
  const uniq = `RM-${Date.now()}`;
  let siteId = '';

  beforeAll(async () => {
    const { data } = await service()
      .from('sites')
      .insert({ code: `S-${uniq}`, name: 'Role matrix test' })
      .select()
      .single();
    siteId = data!.id;
  });

  afterAll(async () => {
    const svc = service();
    await svc.from('items').delete().like('code', `I-${uniq}%`);
    await svc.from('parties').delete().like('name', `RM-${uniq}%`);
    await svc.from('site_user_access').delete().eq('site_id', siteId);
    await svc.from('sites').delete().eq('id', siteId);
  });

  it.each([
    // Only SUPER_ADMIN passes is_admin_anywhere() on global role alone.
    // Global ADMIN with NO site_user_access row does NOT (by design — see
    // docs/permissions.md: "SUPER_ADMIN globally, or ADMIN on at least
    // one site"). Tested separately below.
    { role: 'VIEWER', allow: false },
    { role: 'SITE_ENGINEER', allow: false },
    { role: 'STORE_MANAGER', allow: false },
    { role: 'ADMIN', allow: false },
    { role: 'SUPER_ADMIN', allow: true },
  ])('items INSERT — $role (global only) → allow=$allow', async ({ role, allow }) => {
    const u = await asUser(`rm-${role.toLowerCase()}@test.local`);
    const { data: who } = await u.auth.getUser();
    await setGlobalRole(who.user!.id, role);

    const res = await u
      .from('items')
      .insert({ code: `I-${uniq}-${role}`, name: `RM ${role}`, unit: 'NOS' });

    if (allow) expect(res.error).toBeNull();
    else expect(res.error).not.toBeNull();
  });

  it('ADMIN on a site (not global) counts as admin-anywhere for items', async () => {
    const u = await asUser('rm-site-admin@test.local');
    const { data: who } = await u.auth.getUser();
    await setGlobalRole(who.user!.id, 'VIEWER'); // VIEWER globally

    // Grant ADMIN on one site — is_admin_anywhere() should return true
    await service()
      .from('site_user_access')
      .insert({ user_id: who.user!.id, site_id: siteId, role_id: 'ADMIN' });

    const res = await u
      .from('items')
      .insert({ code: `I-${uniq}-SITE-ADMIN`, name: 'Site-admin insert', unit: 'NOS' });
    expect(res.error).toBeNull();
  });

  it('VIEWER with site_user_access as STORE_MANAGER still cannot write masters', async () => {
    const u = await asUser('rm-sm@test.local');
    const { data: who } = await u.auth.getUser();
    await setGlobalRole(who.user!.id, 'VIEWER');
    await service()
      .from('site_user_access')
      .upsert(
        { user_id: who.user!.id, site_id: siteId, role_id: 'STORE_MANAGER' },
        { onConflict: 'site_id,user_id' },
      );

    const res = await u
      .from('items')
      .insert({ code: `I-${uniq}-SM`, name: 'SM denied', unit: 'NOS' });
    expect(res.error).not.toBeNull();
  });
});

describe('role matrix — transaction writes via can_user', () => {
  const uniq = `RMT-${Date.now()}`;
  let siteId = '';
  let itemId = '';

  beforeAll(async () => {
    const svc = service();
    const { data: site } = await svc
      .from('sites')
      .insert({ code: `S-${uniq}`, name: 'Txn matrix' })
      .select()
      .single();
    siteId = site!.id;
    const { data: item } = await svc
      .from('items')
      .insert({ code: `I-${uniq}`, name: 'Txn matrix item', unit: 'NOS' })
      .select()
      .single();
    itemId = item!.id;
  });

  afterAll(async () => {
    const svc = service();
    await svc.from('purchases').delete().eq('site_id', siteId);
    await svc.from('issues').delete().eq('site_id', siteId);
    await svc.from('site_user_access').delete().eq('site_id', siteId);
    await svc.from('items').delete().eq('id', itemId);
    await svc.from('sites').delete().eq('id', siteId);
  });

  it('STORE_MANAGER on site can INSERT purchase', async () => {
    const u = await asUser('rmt-sm-allow@test.local');
    const { data: who } = await u.auth.getUser();
    await setGlobalRole(who.user!.id, 'VIEWER');
    await service()
      .from('site_user_access')
      .upsert(
        { user_id: who.user!.id, site_id: siteId, role_id: 'STORE_MANAGER' },
        { onConflict: 'site_id,user_id' },
      );

    const res = await u.from('purchases').insert({
      site_id: siteId,
      item_id: itemId,
      received_qty: 5,
      received_unit: 'NOS',
      stock_unit: 'NOS',
    });
    expect(res.error).toBeNull();
  });

  it('SITE_ENGINEER on site cannot INSERT purchase (INVENTORY.CREATE not granted)', async () => {
    const u = await asUser('rmt-se-deny@test.local');
    const { data: who } = await u.auth.getUser();
    await setGlobalRole(who.user!.id, 'VIEWER');
    await service()
      .from('site_user_access')
      .upsert(
        { user_id: who.user!.id, site_id: siteId, role_id: 'SITE_ENGINEER' },
        { onConflict: 'site_id,user_id' },
      );

    const res = await u.from('purchases').insert({
      site_id: siteId,
      item_id: itemId,
      received_qty: 1,
      received_unit: 'NOS',
      stock_unit: 'NOS',
    });
    expect(res.error).not.toBeNull();
  });
});
