/**
 * RLS — `role_permissions` matrix.
 *
 * Policy contract:
 *   - SELECT: any authenticated user (the matrix is consumed by the
 *     permission-gate UI and by `can_user()` behind the scenes).
 *   - INSERT/UPDATE/DELETE: SUPER_ADMIN only. These are tenant-wide
 *     default permissions; even site ADMINs cannot mutate them because
 *     a change here silently expands authority on every site.
 *
 * Per-site overrides belong in `site_user_permission_overrides` and
 * are governed by a separate policy.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { asUser, service, setGlobalRole } from './helpers';

const MARKER_ROLE = 'VIEWER';
const MARKER_MODULE = 'REPORTS';
const MARKER_ACTION = 'EXPORT'; // Not in the base seed for VIEWER

async function cleanupMarker() {
  await service()
    .from('role_permissions')
    .delete()
    .eq('role_id', MARKER_ROLE)
    .eq('module_id', MARKER_MODULE)
    .eq('action_id', MARKER_ACTION);
}

describe('role_permissions RLS', () => {
  afterAll(async () => {
    await cleanupMarker();
  });

  it('VIEWER cannot insert a role_permission row', async () => {
    const viewer = await asUser('rls-rp-viewer@test.local');
    const { data: who } = await viewer.auth.getUser();
    await setGlobalRole(who.user!.id, 'VIEWER');

    const { error } = await viewer.from('role_permissions').insert({
      role_id: MARKER_ROLE,
      module_id: MARKER_MODULE,
      action_id: MARKER_ACTION,
    });
    expect(error).not.toBeNull();
  });

  it('ADMIN (global) cannot insert a role_permission row — only SUPER_ADMIN may', async () => {
    const admin = await asUser('rls-rp-admin@test.local');
    const { data: who } = await admin.auth.getUser();
    await setGlobalRole(who.user!.id, 'ADMIN');

    const { error } = await admin.from('role_permissions').insert({
      role_id: MARKER_ROLE,
      module_id: MARKER_MODULE,
      action_id: MARKER_ACTION,
    });
    expect(error).not.toBeNull();
  });

  it('SUPER_ADMIN can insert and delete a role_permission row', async () => {
    const sa = await asUser('rls-rp-sa@test.local');
    const { data: who } = await sa.auth.getUser();
    await setGlobalRole(who.user!.id, 'SUPER_ADMIN');

    const insertRes = await sa.from('role_permissions').insert({
      role_id: MARKER_ROLE,
      module_id: MARKER_MODULE,
      action_id: MARKER_ACTION,
    });
    expect(insertRes.error).toBeNull();

    const deleteRes = await sa
      .from('role_permissions')
      .delete()
      .eq('role_id', MARKER_ROLE)
      .eq('module_id', MARKER_MODULE)
      .eq('action_id', MARKER_ACTION);
    expect(deleteRes.error).toBeNull();

    const { data: check } = await service()
      .from('role_permissions')
      .select('id')
      .eq('role_id', MARKER_ROLE)
      .eq('module_id', MARKER_MODULE)
      .eq('action_id', MARKER_ACTION)
      .maybeSingle();
    expect(check).toBeNull();
  });

  it('any authenticated user can SELECT role_permissions', async () => {
    const viewer = await asUser('rls-rp-select@test.local');
    const { data: who } = await viewer.auth.getUser();
    await setGlobalRole(who.user!.id, 'VIEWER');

    const { data, error } = await viewer
      .from('role_permissions')
      .select('role_id, module_id, action_id')
      .limit(1);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });
});
