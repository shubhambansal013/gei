import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Next.js 16+ convention. Refreshes the
 * Supabase session cookie on every request and redirects unauthenticated
 * traffic to `/login`. See `lib/supabase/middleware.ts` for the body.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico)$).*)'],
};

export const runtime = 'experimental-edge';
