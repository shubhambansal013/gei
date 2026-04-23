import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

/**
 * Server-side Supabase client. Used in Server Components, Route
 * Handlers, and Server Actions. Reads the user's JWT from the Next.js
 * cookie jar; queries run under the user's RLS identity.
 *
 * Never use the service-role key here — RLS is the trust boundary.
 * A server action that needs to bypass RLS (e.g., triggers that use
 * session-local GUCs) should still carry the user's JWT and rely on
 * the DB trigger's SECURITY DEFINER context for elevation.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );
}
