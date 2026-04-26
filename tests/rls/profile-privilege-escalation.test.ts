/**
 * Issue #22 — Before this test and its matching trigger, a
 * SITE_ENGINEER or VIEWER could UPDATE their own `profiles` row and
 * set `role_id = 'SUPER_ADMIN'` to gain full access.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { asUser, service, setGlobalRole } from './helpers';

describe('profile privilege escalation — non-admin cannot self-promote', () => {
  const uniq = `PE${Math.floor(Math.random() * 1000000)}`;
  const adminEmail = `${uniq}-admin@test.local`;
  let adminId = '';

  beforeAll(async () => {
    const a = await asUser(adminEmail);
    const { data: aw } = await a.auth.getUser();
    adminId = aw.user!.id;
    await setGlobalRole(adminId, 'SUPER_ADMIN');
  });

  afterAll(async () => {
    const svc = service();
    if (adminId) await svc.auth.admin.deleteUser(adminId);
  });

  it('VIEWER cannot promote themselves to SUPER_ADMIN', async () => {
    const email = `${uniq}-v1@test.local`;
    const u = await asUser(email);
    const { data: { user } } = await u.auth.getUser();
    await setGlobalRole(user!.id, 'VIEWER');

    const { error } = await u
      .from('profiles')
      .update({ role_id: 'SUPER_ADMIN' })
      .eq('id', user!.id);

    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');

    await service().auth.admin.deleteUser(user!.id);
  });

  it('VIEWER cannot flip is_active on their own row', async () => {
    const email = `${uniq}-v2@test.local`;
    const u = await asUser(email);
    const { data: { user } } = await u.auth.getUser();
    await setGlobalRole(user!.id, 'VIEWER');

    const { error } = await u
      .from('profiles')
      .update({ is_active: false })
      .eq('id', user!.id);

    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');

    await service().auth.admin.deleteUser(user!.id);
  });

  it('VIEWER cannot fabricate approved_at / approved_by', async () => {
    const email = `${uniq}-v3@test.local`;
    const u = await asUser(email);
    const { data: { user } } = await u.auth.getUser();
    await setGlobalRole(user!.id, 'VIEWER');

    const { error } = await u
      .from('profiles')
      .update({ approved_at: new Date().toISOString(), approved_by: user!.id })
      .eq('id', user!.id);

    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');

    await service().auth.admin.deleteUser(user!.id);
  });

  it('VIEWER CAN still update their own full_name', async () => {
    const email = `${uniq}-v4@test.local`;
    const u = await asUser(email);
    const { data: { user } } = await u.auth.getUser();
    await setGlobalRole(user!.id, 'VIEWER');

    const newName = `Updated ${uniq}`;
    const { error } = await u.from('profiles').update({ full_name: newName }).eq('id', user!.id);
    expect(error).toBeNull();

    await service().auth.admin.deleteUser(user!.id);
  });

  it('SUPER_ADMIN can change another user’s role_id', async () => {
    const email = `${uniq}-v5@test.local`;
    const u = await asUser(email);
    const { data: { user } } = await u.auth.getUser();
    await setGlobalRole(user!.id, 'VIEWER');

    const admin = await asUser(adminEmail);
    const { error } = await admin
      .from('profiles')
      .update({ role_id: 'STORE_MANAGER' })
      .eq('id', user!.id);

    expect(error).toBeNull();

    await service().auth.admin.deleteUser(user!.id);
  });
});
