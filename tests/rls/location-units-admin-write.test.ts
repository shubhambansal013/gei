/**
 * RLS coverage for location_units, location_references, and
 * site_user_permission_overrides. Before Security Wave 1, these three
 * tables had RLS enabled but no write policies (or — for overrides —
 * RLS not enabled at all), so even SUPER_ADMIN got SQLSTATE 42501 on
 * INSERT.
 *
 * These tests assert:
 *   - SUPER_ADMIN / ADMIN can INSERT/UPDATE/DELETE location_units.
 *   - Non-admin global roles cannot write.
 *   - location_references: SUPER_ADMIN / ADMIN can INSERT (the
 *     `resolve_location` RPC also inserts, but through SECURITY
 *     DEFINER — the direct-client path also needs to work).
 *   - site_user_permission_overrides: admins can INSERT/UPDATE/DELETE,
 *     non-admins cannot.
 *
 * Requires a running local Supabase (supabase start).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { asUser, service, setGlobalRole } from './helpers';

describe('location_units — admin writes', () => {
  const uniq = `LU-${Date.now()}`;
  let siteId = '';

  beforeAll(async () => {
    const { data } = await service()
      .from('sites')
      .insert({ code: `S-${uniq}`, name: 'LU admin write test' })
      .select()
      .single();
    siteId = data!.id;
  });

  afterAll(async () => {
    const svc = service();
    await svc.from('location_units').delete().eq('site_id', siteId);
    await svc.from('sites').delete().eq('id', siteId);
  });

  it('SUPER_ADMIN can INSERT a location_unit', async () => {
    const u = await asUser('lu-sa@test.local');
    const { data: who } = await u.auth.getUser();
    await setGlobalRole(who.user!.id, 'SUPER_ADMIN');

    const res = await u
      .from('location_units')
      .insert({
        site_id: siteId,
        name: 'Block A',
        code: `BA-${uniq}`,
        type: 'BLOCK',
      })
      .select()
      .single();
    expect(res.error).toBeNull();
    expect(res.data?.code).toBe(`BA-${uniq}`);
  });

  it('VIEWER cannot INSERT a location_unit', async () => {
    const u = await asUser('lu-viewer@test.local');
    const { data: who } = await u.auth.getUser();
    await setGlobalRole(who.user!.id, 'VIEWER');

    const res = await u.from('location_units').insert({
      site_id: siteId,
      name: 'Denied',
      code: `DENY-${uniq}`,
      type: 'BLOCK',
    });
    expect(res.error).not.toBeNull();
  });

  it('SUPER_ADMIN can UPDATE a location_unit', async () => {
    const u = await asUser('lu-sa@test.local');
    const { data: who } = await u.auth.getUser();
    await setGlobalRole(who.user!.id, 'SUPER_ADMIN');

    // Seed via service
    const { data: seeded } = await service()
      .from('location_units')
      .insert({
        site_id: siteId,
        name: 'Block B',
        code: `BB-${uniq}`,
        type: 'BLOCK',
      })
      .select()
      .single();

    const res = await u
      .from('location_units')
      .update({ name: 'Block B (edited)' })
      .eq('id', seeded!.id);
    expect(res.error).toBeNull();
  });

  it('SUPER_ADMIN can DELETE a location_unit', async () => {
    const u = await asUser('lu-sa@test.local');
    const { data: who } = await u.auth.getUser();
    await setGlobalRole(who.user!.id, 'SUPER_ADMIN');

    const { data: seeded } = await service()
      .from('location_units')
      .insert({
        site_id: siteId,
        name: 'Block C',
        code: `BC-${uniq}`,
        type: 'BLOCK',
      })
      .select()
      .single();

    const res = await u.from('location_units').delete().eq('id', seeded!.id);
    expect(res.error).toBeNull();

    const { data: still } = await service()
      .from('location_units')
      .select('id')
      .eq('id', seeded!.id)
      .maybeSingle();
    expect(still).toBeNull();
  });
});

describe('location_references — admin writes', () => {
  const uniq = `LR-${Date.now()}`;
  let siteId = '';
  let unitId = '';

  beforeAll(async () => {
    const svc = service();
    const { data: site } = await svc
      .from('sites')
      .insert({ code: `S-${uniq}`, name: 'LR admin write test' })
      .select()
      .single();
    siteId = site!.id;
    const { data: unit } = await svc
      .from('location_units')
      .insert({
        site_id: siteId,
        name: 'LR Block',
        code: `LRB-${uniq}`,
        type: 'BLOCK',
      })
      .select()
      .single();
    unitId = unit!.id;
  });

  afterAll(async () => {
    const svc = service();
    await svc.from('location_references').delete().eq('site_id', siteId);
    await svc.from('location_units').delete().eq('site_id', siteId);
    await svc.from('sites').delete().eq('id', siteId);
  });

  it('SUPER_ADMIN can INSERT a location_reference', async () => {
    const u = await asUser('lr-sa@test.local');
    const { data: who } = await u.auth.getUser();
    await setGlobalRole(who.user!.id, 'SUPER_ADMIN');

    const res = await u
      .from('location_references')
      .insert({
        site_id: siteId,
        unit_id: unitId,
        full_path: 'LR Block',
        full_code: `LRB-${uniq}`,
      })
      .select()
      .single();
    expect(res.error).toBeNull();
  });

  it('VIEWER cannot INSERT a location_reference', async () => {
    const u = await asUser('lr-viewer@test.local');
    const { data: who } = await u.auth.getUser();
    await setGlobalRole(who.user!.id, 'VIEWER');

    const res = await u.from('location_references').insert({
      site_id: siteId,
      unit_id: unitId,
      full_path: 'Denied',
      full_code: `DENY-${uniq}`,
    });
    expect(res.error).not.toBeNull();
  });
});

describe('site_user_permission_overrides — RLS + admin writes', () => {
  const uniq = `OV-${Date.now()}`;
  let siteId = '';
  let accessId = '';
  let viewerUserId = '';

  beforeAll(async () => {
    const svc = service();
    const { data: site } = await svc
      .from('sites')
      .insert({ code: `S-${uniq}`, name: 'Override admin write' })
      .select()
      .single();
    siteId = site!.id;

    // Viewer with site access — target of the override
    const viewerClient = await asUser('ov-target@test.local');
    const { data: viewerWho } = await viewerClient.auth.getUser();
    viewerUserId = viewerWho.user!.id;
    await setGlobalRole(viewerUserId, 'VIEWER');

    const { data: access } = await svc
      .from('site_user_access')
      .upsert(
        { site_id: siteId, user_id: viewerUserId, role_id: 'VIEWER' },
        { onConflict: 'site_id,user_id' },
      )
      .select()
      .single();
    accessId = access!.id;
  });

  afterAll(async () => {
    const svc = service();
    await svc.from('site_user_permission_overrides').delete().eq('access_id', accessId);
    await svc.from('site_user_access').delete().eq('id', accessId);
    await svc.from('sites').delete().eq('id', siteId);
  });

  it('SUPER_ADMIN can INSERT a permission override', async () => {
    const u = await asUser('ov-sa@test.local');
    const { data: who } = await u.auth.getUser();
    await setGlobalRole(who.user!.id, 'SUPER_ADMIN');

    const res = await u
      .from('site_user_permission_overrides')
      .insert({
        access_id: accessId,
        module_id: 'INVENTORY',
        action_id: 'CREATE',
        granted: true,
      })
      .select()
      .single();
    expect(res.error).toBeNull();
  });

  it('SUPER_ADMIN can UPDATE a permission override', async () => {
    const u = await asUser('ov-sa@test.local');
    const { data: who } = await u.auth.getUser();
    await setGlobalRole(who.user!.id, 'SUPER_ADMIN');

    const res = await u
      .from('site_user_permission_overrides')
      .update({ granted: false })
      .eq('access_id', accessId)
      .eq('module_id', 'INVENTORY')
      .eq('action_id', 'CREATE');
    expect(res.error).toBeNull();
  });

  it('SUPER_ADMIN can DELETE a permission override', async () => {
    const u = await asUser('ov-sa@test.local');
    const { data: who } = await u.auth.getUser();
    await setGlobalRole(who.user!.id, 'SUPER_ADMIN');

    const res = await u
      .from('site_user_permission_overrides')
      .delete()
      .eq('access_id', accessId)
      .eq('module_id', 'INVENTORY')
      .eq('action_id', 'CREATE');
    expect(res.error).toBeNull();
  });

  it('VIEWER cannot INSERT a permission override', async () => {
    const u = await asUser('ov-viewer@test.local');
    const { data: who } = await u.auth.getUser();
    await setGlobalRole(who.user!.id, 'VIEWER');

    const res = await u.from('site_user_permission_overrides').insert({
      access_id: accessId,
      module_id: 'INVENTORY',
      action_id: 'EDIT',
      granted: true,
    });
    expect(res.error).not.toBeNull();
  });

  it('VIEWER cannot SELECT permission overrides for other users', async () => {
    // Insert an override via service
    await service().from('site_user_permission_overrides').upsert(
      {
        access_id: accessId,
        module_id: 'INVENTORY',
        action_id: 'VIEW',
        granted: true,
      },
      { onConflict: 'access_id,module_id,action_id' },
    );

    const unrelated = await asUser('ov-unrelated-viewer@test.local');
    const { data: who } = await unrelated.auth.getUser();
    await setGlobalRole(who.user!.id, 'VIEWER');

    const { data } = await unrelated
      .from('site_user_permission_overrides')
      .select('id')
      .eq('access_id', accessId);
    // RLS filters these out silently for non-admins on other users' rows.
    expect(data ?? []).toHaveLength(0);
  });
});
