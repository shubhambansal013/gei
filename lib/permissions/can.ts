import type { PermissionKey } from './types';

/**
 * We deliberately accept any Supabase-client-shaped object here. The
 * generated client narrows `rpc`'s `fn` arg to a literal union, which
 * would make `createCan` unusable unless we import and thread the
 * generated `Database` type everywhere. Since the helper only ever
 * calls `rpc('can_user', ...)`, keeping the type broad is the
 * pragmatic tradeoff — tests pass a minimal mock, prod passes the
 * real client, neither suffers.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RpcClient = any;

/**
 * Creates a memoized `can(key)` function.
 *
 * The cache is scoped to the returned function instance — a single
 * (siteId × module × action) key is looked up at most once per session.
 * Recreate after sign-in / sign-out to flush.
 *
 * This is a **UI hint only**. The DB's `can_user()` function is the
 * authoritative check, called from every RLS policy. Never use the
 * result of `can()` to gate data access or bypass a fetch.
 *
 * @param client   A Supabase client (browser or server) with `.rpc()`
 *                 and optional `.auth.getUser()`.
 * @param userId   If known, skips the extra `getUser()` round-trip.
 */
export function createCan(client: RpcClient, userId?: string) {
  const cache = new Map<string, Promise<boolean>>();

  const resolveUserId = async () => {
    if (userId) return userId;
    const authApi = client.auth;
    if (!authApi) return '';
    const { data } = await authApi.getUser();
    return data.user?.id ?? '';
  };

  return async function can(key: PermissionKey): Promise<boolean> {
    const cacheKey = `${key.siteId}:${key.module}:${key.action}`;
    const hit = cache.get(cacheKey);
    if (hit) return hit;

    const promise = (async () => {
      const uid = await resolveUserId();
      const { data, error } = await client.rpc('can_user', {
        p_user_id: uid,
        p_site_id: key.siteId,
        p_module_id: key.module,
        p_action_id: key.action,
      });
      if (error) return false;
      return Boolean(data);
    })();

    cache.set(cacheKey, promise);
    return promise;
  };
}
