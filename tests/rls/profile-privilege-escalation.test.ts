/**
 * Issue #22 — Before this test and its matching trigger, a
 * SITE_ENGINEER or VIEWER could UPDATE their own `profiles` row and
 * set `role_id = 'SUPER_ADMIN'` to gain full access.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { asUser, service, setGlobalRole } from './helpers';

describe('profile privilege escalation — non-admin cannot self-promote', () => {
  const uniq = `PE-${Date.now()}`;
  const viewerEmail = `${uniq}-viewer@test.local`;
  const engineerEmail = `${uniq}-engineer@test.local`;
  const adminEmail = `${uniq}-admin@test.local`;
  let viewerId = '';
  let engineerId = '';
  let adminId = '';

  beforeAll(async () => {
    const v = await asUser(viewerEmail);
    const e = await asUser(engineerEmail);
    const a = await asUser(adminEmail);

    const { data: vw } = await v.auth.getUser();
    const { data: ew } = await e.auth.getUser();
    const { data: aw } = await a.auth.getUser();

    viewerId = vw.user!.id;
    engineerId = ew.user!.id;
    adminId = aw.user!.id;

    // Ensure all are active so they can read themselves
    await setGlobalRole(adminId, 'SUPER_ADMIN');
    await setGlobalRole(viewerId, 'VIEWER');
    await setGlobalRole(engineerId, 'SITE_ENGINEER');
  });

  afterAll(async () => {
    const svc = service();
    for (const id of [viewerId, engineerId, adminId]) {
      if (id) await svc.auth.admin.deleteUser(id);
    }
  });

  it('VIEWER cannot promote themselves to SUPER_ADMIN', async () => {
    const u = await asUser(viewerEmail);
    const { error } = await u
      .from('profiles')
      .update({ role_id: 'SUPER_ADMIN' })
      .eq('id', viewerId);
    expect(error).not.toBeNull();
  });

  it('SITE_ENGINEER cannot promote themselves to ADMIN', async () => {
    const u = await asUser(engineerEmail);
    const { error } = await u.from('profiles').update({ role_id: 'ADMIN' }).eq('id', engineerId);
    expect(error).not.toBeNull();
  });

  it('VIEWER cannot flip is_active on their own row', async () => {
    const u = await asUser(viewerEmail);
    const { error } = await u.from('profiles').update({ is_active: false }).eq('id', viewerId);
    expect(error).not.toBeNull();
  });

  it('VIEWER cannot fabricate approved_at / approved_by', async () => {
    const u = await asUser(viewerEmail);
    const { error } = await u
      .from('profiles')
      .update({ approved_at: new Date().toISOString(), approved_by: viewerId })
      .eq('id', viewerId);
    expect(error).not.toBeNull();
  });

  it('VIEWER CAN still update their own full_name', async () => {
    const u = await asUser(viewerEmail);
    const newName = `Updated ${uniq}`;
    const { error } = await u.from('profiles').update({ full_name: newName }).eq('id', viewerId);
    expect(error).toBeNull();
  });

  it('SUPER_ADMIN can change another user’s role_id', async () => {
    const u = await asUser(adminEmail);
    const { error } = await u
      .from('profiles')
      .update({ role_id: 'STORE_MANAGER' })
      .eq('id', viewerId);
    expect(error).toBeNull();
    // restore
    await service().from('profiles').update({ role_id: 'VIEWER' }).eq('id', viewerId);
  });
});
