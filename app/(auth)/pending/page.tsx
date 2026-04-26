'use client';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';

/**
 * Shown to any signed-in user whose profile is `is_active=false`.
 * The `middleware.ts` sends every non-auth, non-asset request
 * from a pending user here until an admin approves them (via
 * the Users master page).
 *
 * Client component so the Sign-out button can call
 * `supabase.auth.signOut()` directly — users who want to try a
 * different Google account shouldn't have to clear cookies by hand.
 */
export default function PendingPage() {
  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    window.location.assign('/login');
  };

  return (
    <main className="bg-muted/30 grid min-h-screen place-items-center p-6">
      <div className="bg-card w-full max-w-[420px] rounded-md border p-8 text-center shadow-sm">
        <div className="mb-6 flex items-baseline justify-center gap-2">
          <span className="text-primary font-mono text-2xl font-bold tracking-tight">GEI</span>
          <span className="text-muted-foreground text-sm font-medium">inventory</span>
        </div>

        <h1 className="mb-2 text-lg font-semibold">Awaiting approval</h1>
        <p className="text-muted-foreground mb-6 text-sm">
          Your access is awaiting approval from an administrator. You&apos;ll be notified when
          it&apos;s granted.
        </p>

        <Button variant="outline" size="sm" onClick={signOut} className="w-full">
          Sign out
        </Button>
      </div>
    </main>
  );
}
