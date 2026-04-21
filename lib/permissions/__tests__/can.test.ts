import { describe, it, expect, vi } from 'vitest';
import { createCan } from '../can';

function mockClient(rpcReturn: { data: unknown; error: unknown }) {
  return {
    rpc: vi.fn().mockResolvedValue(rpcReturn),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
    },
  };
}

describe('createCan', () => {
  it('returns true when RPC returns true', async () => {
    const client = mockClient({ data: true, error: null });
    const can = createCan(client);
    const allowed = await can({ siteId: 'S1', module: 'INVENTORY', action: 'VIEW' });
    expect(allowed).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith('can_user', {
      p_user_id: 'u1',
      p_site_id: 'S1',
      p_module_id: 'INVENTORY',
      p_action_id: 'VIEW',
    });
  });

  it('returns false when RPC errors', async () => {
    const client = mockClient({ data: null, error: { message: 'nope' } });
    const can = createCan(client);
    expect(await can({ siteId: 'S1', module: 'INVENTORY', action: 'VIEW' })).toBe(false);
  });

  it('caches repeated lookups within a session', async () => {
    const client = mockClient({ data: true, error: null });
    const can = createCan(client);
    await can({ siteId: 'S1', module: 'INVENTORY', action: 'VIEW' });
    await can({ siteId: 'S1', module: 'INVENTORY', action: 'VIEW' });
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });

  it('treats different keys as cache-distinct', async () => {
    const client = mockClient({ data: true, error: null });
    const can = createCan(client);
    await can({ siteId: 'S1', module: 'INVENTORY', action: 'VIEW' });
    await can({ siteId: 'S1', module: 'INVENTORY', action: 'EDIT' });
    await can({ siteId: 'S2', module: 'INVENTORY', action: 'VIEW' });
    expect(client.rpc).toHaveBeenCalledTimes(3);
  });

  it('uses supplied userId without calling getUser', async () => {
    const client = mockClient({ data: true, error: null });
    const can = createCan(client, 'pre-known-uid');
    await can({ siteId: 'S1', module: 'INVENTORY', action: 'VIEW' });
    expect(client.auth.getUser).not.toHaveBeenCalled();
    expect(client.rpc).toHaveBeenCalledWith(
      'can_user',
      expect.objectContaining({ p_user_id: 'pre-known-uid' }),
    );
  });
});
