import { describe, it, expect } from 'vitest';
import { asUser, service, setGlobalRole, cleanupItem } from './helpers';

describe('masters RLS', () => {
  it('VIEWER cannot insert an item', async () => {
    const viewer = await asUser('viewer@test.local');
    const { data: who } = await viewer.auth.getUser();
    await setGlobalRole(who.user!.id, 'VIEWER');

    const { error } = await viewer.from('items').insert({
      name: 'Forbidden',
      unit: 'NOS',
      code: 'RLS-FORBIDDEN-1',
    });
    expect(error).not.toBeNull();
    await cleanupItem('RLS-FORBIDDEN-1');
  });

  it('SUPER_ADMIN can insert an item', async () => {
    const admin = await asUser('sa@test.local');
    const { data: who } = await admin.auth.getUser();
    await setGlobalRole(who.user!.id, 'SUPER_ADMIN');

    const { error } = await admin.from('items').insert({
      name: 'Rebar 8mm',
      unit: 'MT',
      code: 'RLS-ALLOW-1',
    });
    expect(error).toBeNull();
    await cleanupItem('RLS-ALLOW-1');
  });

  it('any authenticated user can SELECT items', async () => {
    const viewer = await asUser('viewer2@test.local');
    const { data: who } = await viewer.auth.getUser();
    await setGlobalRole(who.user!.id, 'VIEWER');

    // Ensure at least one item exists
    await service()
      .from('items')
      .upsert({ name: 'Anyone', unit: 'NOS', code: 'RLS-ANY-1' }, { onConflict: 'code' });

    const { data, error } = await viewer.from('items').select('id, code').eq('code', 'RLS-ANY-1');
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    await cleanupItem('RLS-ANY-1');
  });

  it('hard DELETE is never allowed on purchases', async () => {
    const admin = await asUser('sa@test.local');
    const { data: who } = await admin.auth.getUser();
    await setGlobalRole(who.user!.id, 'SUPER_ADMIN');

    // Seed a site, item, purchase via service role
    const svc = service();
    const { data: site } = await svc
      .from('sites')
      .upsert({ code: 'RLS-SITE-1', name: 'Test Site' }, { onConflict: 'code' })
      .select()
      .single();
    const { data: item } = await svc
      .from('items')
      .upsert({ code: 'RLS-ITM-1', name: 'Test', unit: 'NOS' }, { onConflict: 'code' })
      .select()
      .single();
    const { data: purchase } = await svc
      .from('purchases')
      .insert({
        site_id: site!.id,
        item_id: item!.id,
        received_qty: 1,
        received_unit: 'NOS',
        stock_unit: 'NOS',
      })
      .select()
      .single();

    // Even SUPER_ADMIN cannot hard-delete. Supabase doesn't return an
    // error when a DELETE matches zero rows due to RLS; it silently
    // affects nothing. Verify by re-reading the row.
    await admin.from('purchases').delete().eq('id', purchase!.id);
    const { data: stillThere } = await svc
      .from('purchases')
      .select('id')
      .eq('id', purchase!.id)
      .maybeSingle();
    expect(stillThere?.id).toBe(purchase!.id);

    // Cleanup via service role (bypasses the no-delete policy)
    await svc.from('purchases').delete().eq('id', purchase!.id);
    await svc.from('items').delete().eq('code', 'RLS-ITM-1');
    await svc.from('sites').delete().eq('code', 'RLS-SITE-1');
  });
});
