import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { asUser, service, setGlobalRole } from './helpers';

describe('location_templates RLS', () => {
  it('VIEWER should NOT be able to insert a location_template', async () => {
    const u = await asUser('template-viewer@test.local');
    const { data: who } = await u.auth.getUser();
    await setGlobalRole(who.user!.id, 'VIEWER');

    const res = await u.from('location_templates').insert({
      name: 'Test Template',
    });

    // If RLS is missing or misconfigured, this might succeed.
    // We WANT it to fail (res.error should be present).
    expect(res.error).not.toBeNull();
  });
});
