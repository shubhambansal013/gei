import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TEST_PASSWORD = 'test-password-1234';

/**
 * Service-role client that bypasses RLS. Use ONLY from tests and
 * server-only admin utilities — never import from frontend code.
 */
export function service(): SupabaseClient {
  return createClient(URL, SERVICE, { auth: { persistSession: false } });
}

/**
 * Returns a Supabase client authenticated as the given test email.
 * The user is created on first use (with a known password) and
 * auto-confirmed. RLS applies to every query this client makes.
 */
export async function asUser(email: string): Promise<SupabaseClient> {
  const admin = service();
  const { data: list } = await admin.auth.admin.listUsers();
  let user = list?.users.find((u) => u.email === email);
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: TEST_PASSWORD,
    });
    user = created.data.user ?? undefined;
  }
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  return client;
}

/**
 * Overwrites the given user's global role. Use to shape a test subject
 * without touching `site_user_access`.
 *
 * Also marks the profile active. Security-Wave-1 migration
 * `20260423000002_signup_approval.sql` defaults new signups to
 * `is_active=false`, so without this flip every RLS test that assumes
 * the user can act would start returning 42501. Tests that want to
 * exercise the inactive path set `is_active` back to false explicitly.
 */
export async function setGlobalRole(userId: string, roleId: string) {
  await service().from('profiles').update({ role_id: roleId, is_active: true }).eq('id', userId);
}

/** Wipes rows inserted by a test — call in afterEach/afterAll blocks. */
export async function cleanupItem(code: string) {
  await service().from('items').delete().eq('code', code);
}
