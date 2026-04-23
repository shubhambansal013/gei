'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabaseBrowser } from '@/lib/supabase/browser';

/**
 * Primary sign-in is Google OAuth. An email/password fallback is wired
 * in below the Google button so the app can be smoke-tested immediately
 * against local Supabase without creating a Google Cloud OAuth client.
 *
 * Production hides the email form by setting
 * `NEXT_PUBLIC_ENABLE_EMAIL_SIGNIN=false` at build time.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');

  const enableEmail = process.env.NEXT_PUBLIC_ENABLE_EMAIL_SIGNIN !== 'false';

  const onGoogle = async () => {
    setMsg(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setMsg(error.message);
  };

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = supabaseBrowser();
    try {
      if (mode === 'sign-up') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg('Account created. Sign in with the same credentials.');
        setMode('sign-in');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Full reload so middleware re-runs with the fresh session cookie.
        window.location.assign('/dashboard');
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="bg-muted/30 grid min-h-screen place-items-center p-6">
      <div className="bg-card w-full max-w-[420px] rounded-md border p-8 shadow-sm">
        {/* Brand lockup — monospace wordmark doing double duty as a logo. */}
        <div className="mb-8 flex items-baseline gap-2">
          <span className="text-primary font-mono text-2xl font-bold tracking-tight">GEI</span>
        </div>

        <h1 className="mb-1 text-lg font-semibold">Sign in</h1>
        <p className="text-muted-foreground mb-6 text-sm">
          Continue to your assigned sites.
        </p>

        <Button className="w-full" onClick={onGoogle}>
          Continue with Google
        </Button>

        {enableEmail && (
          <>
            <div className="text-muted-foreground my-5 flex items-center gap-3 text-xs tracking-wider uppercase">
              <Separator className="flex-1" />
              <span>or</span>
              <Separator className="flex-1" />
            </div>

            <form onSubmit={onEmail} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" variant="outline" className="w-full" disabled={busy}>
                {busy ? 'Working…' : mode === 'sign-up' ? 'Create account' : 'Sign in with email'}
              </Button>
            </form>

            <p className="text-muted-foreground mt-4 text-center text-xs">
              {mode === 'sign-in' ? (
                <>
                  New here?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('sign-up')}
                    className="text-primary font-medium underline-offset-4 hover:underline"
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('sign-in')}
                    className="text-primary font-medium underline-offset-4 hover:underline"
                  >
                    Sign in instead
                  </button>
                </>
              )}
            </p>
          </>
        )}

        {msg && (
          <div className="border-destructive bg-destructive/5 text-destructive mt-4 rounded-sm border-l-2 px-3 py-2 text-xs">
            {msg}
          </div>
        )}
      </div>

      <p className="text-muted-foreground mt-6 text-xs">
        GEI · multi-site, role-scoped, audited
      </p>
    </main>
  );
}
