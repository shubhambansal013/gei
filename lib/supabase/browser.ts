import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

/**
 * Browser-side Supabase client. Carries the logged-in user's JWT via
 * cookies managed by `@supabase/ssr`. Every query it makes is
 * RLS-authorized — the client never sees the service-role key.
 *
 * Safe to call from Client Components; never from Server Components
 * (use `supabaseServer()` for those).
 */
export const supabaseBrowser = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
