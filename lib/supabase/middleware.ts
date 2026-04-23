import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * unauthenticated traffic to /login. Called from `proxy.ts` at the
 * repo root.
 *
 * The auth exemption matches `/login`, `/pending`, `/auth/*`, and
 * `/api/auth/*` (OAuth callback / session helpers). Everything else
 * requires a session.
 *
 * Post Security-Wave-1 (Issue #12): a signed-in user whose profile
 * is `is_active=false` is redirected to `/pending` on every
 * non-auth, non-asset route. This keeps newly signed-up users out of
 * the app until an admin approves them — RLS would reject their
 * queries anyway, but the middleware stop is cleaner UX than a blank
 * dashboard.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/pending') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/auth');

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Active-approval gate. Skip for auth routes (`/pending` itself
  // must render, otherwise we'd redirect-loop) and for users we have
  // no profile row for yet (the trigger is SECURITY DEFINER — if the
  // row is missing, treat as pending and send to /pending rather
  // than trap them).
  if (user && !isAuthRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || profile.is_active !== true) {
      const url = request.nextUrl.clone();
      url.pathname = '/pending';
      return NextResponse.redirect(url);
    }
  }

  return response;
}
