/**
 * Issue #22 — Before this test and its matching trigger, a
 * SITE_ENGINEER or VIEWER could UPDATE their own `profiles` row and
 * set `role_id = 'SUPER_ADMIN'` to gain full access.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { asUser, service, setGlobalRole } from './helpers';

describe('profile privilege escalation — non-admin cannot self-promote', () => {
  const uniq = `PE${Math.floor(Math.random() * 1000000)}`;
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

    // Ensure all are active and roles are set
    await setGlobalRole(adminId, 'SUPER_ADMIN');
    await setGlobalRole(viewerId, 'VIEWER');
    await setGlobalRole(engineerId, 'SITE_ENGINEER');
  });

  afterAll(async () => {
    const svc = service();
    for (const id of [viewerId, engineerId, adminId]) {
      if (id) {
        try {
          await svc.auth.admin.deleteUser(id);
        } catch (e) {
          // Ignore delete errors during cleanup
        }
      }
    }
  });

  it('VIEWER cannot promote themselves to SUPER_ADMIN', async () => {
    const u = await asUser(viewerEmail);
    const { error } = await u
      .from('profiles')
      .update({ role_id: 'SUPER_ADMIN' })
      .eq('id', viewerId);
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('VIEWER cannot flip is_active on their own row', async () => {
    const u = await asUser(viewerEmail);
    const { error } = await u.from('profiles').update({ is_active: false }).eq('id', viewerId);
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('VIEWER cannot fabricate approved_at / approved_by', async () => {
    const u = await asUser(viewerEmail);
    const { error } = await u
      .from('profiles')
      .update({ approved_at: new Date().toISOString(), approved_by: viewerId })
      .eq('id', viewerId);
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
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
  });
});
