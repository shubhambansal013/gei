export const runtime = "edge";
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * OAuth callback. Supabase sends the user here after Google confirms
 * identity; we exchange the short-lived code for a session and drop
 * them on `/dashboard`. The session cookies are set by
 * `@supabase/ssr`'s cookie adapter wired into `supabaseServer()`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (code) {
    const supabase = await supabaseServer();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL('/dashboard', url.origin));
}
