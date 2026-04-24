/**
 * Issue #22 — Before this test and its matching trigger, a
 * SITE_ENGINEER or VIEWER could UPDATE their own `profiles` row and
 * set `role_id = 'SUPER_ADMIN'` to gain full access. The RLS policy
 * `profiles_update_self_or_admin` from 20260420000004_masters_rls.sql
 * has no WITH CHECK column guard; the fix lives in
 * 20260424000001_fix_profile_privilege_escalation.sql as a
 * BEFORE UPDATE trigger that raises 42501 on any non-admin attempt
 * to touch role_id / is_active / approved_at / approved_by.
 *
 * Requires a running local Supabase (supabase start).
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

    viewerId = (await v.auth.getUser()).data.user!.id;
    engineerId = (await e.auth.getUser()).data.user!.id;
    adminId = (await a.auth.getUser()).data.user!.id;

    // Admin is active SUPER_ADMIN; the other two are active at their
    // nominal role so they can read their own profile via RLS.
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
    // Trigger raises 42501 — Postgrest surfaces it as an error.
    expect(error).not.toBeNull();
    const { data: after } = await service()
      .from('profiles')
      .select('role_id')
      .eq('id', viewerId)
      .single();
    expect(after?.role_id).toBe('VIEWER');
  });

  it('SITE_ENGINEER cannot promote themselves to ADMIN', async () => {
    const u = await asUser(engineerEmail);
    const { error } = await u.from('profiles').update({ role_id: 'ADMIN' }).eq('id', engineerId);
    expect(error).not.toBeNull();
    const { data: after } = await service()
      .from('profiles')
      .select('role_id')
      .eq('id', engineerId)
      .single();
    expect(after?.role_id).toBe('SITE_ENGINEER');
  });

  it('VIEWER cannot flip is_active on their own row', async () => {
    // Start active (so the login path works), then try to re-flip via
    // the self path — any is_active change from a non-admin is blocked.
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
    const { data: after } = await service()
      .from('profiles')
      .select('full_name')
      .eq('id', viewerId)
      .single();
    expect(after?.full_name).toBe(newName);
  });

  it('SUPER_ADMIN can change another user’s role_id', async () => {
    const u = await asUser(adminEmail);
    const { error } = await u
      .from('profiles')
      .update({ role_id: 'STORE_MANAGER' })
      .eq('id', viewerId);
    expect(error).toBeNull();
    const { data: after } = await service()
      .from('profiles')
      .select('role_id')
      .eq('id', viewerId)
      .single();
    expect(after?.role_id).toBe('STORE_MANAGER');
    // restore for other tests
    await service().from('profiles').update({ role_id: 'VIEWER' }).eq('id', viewerId);
  });
});
