'use client';
import { Button } from '@/components/ui/button';
import { supabaseBrowser } from '@/lib/supabase/browser';

/**
 * Google-OAuth-only sign-in page. On success, Supabase redirects to
 * `/auth/callback` (a Route Handler) which exchanges the code and then
 * drops the user on `/dashboard`. Users without any `site_user_access`
 * row land on `/pending` instead, handled by a post-sign-in check
 * performed in the app layout.
 */
export default function LoginPage() {
  const onSignIn = async () => {
    const supabase = supabaseBrowser();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-gray-50">
      <div className="w-[360px] rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">GEI Inventory</h1>
        <p className="mb-6 text-sm text-gray-600">Sign in with your Google account.</p>
        <Button className="w-full" onClick={onSignIn}>
          Sign in with Google
        </Button>
      </div>
    </main>
  );
}
