'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabaseBrowser } from '@/lib/supabase/browser';

/**
 * Primary sign-in path is Google OAuth. Because enabling Google
 * locally requires creating a Google Cloud OAuth client, an email /
 * password fallback is wired in so the app can be smoke-tested
 * immediately against local Supabase.
 *
 * Production hides the email form by setting
 * `NEXT_PUBLIC_ENABLE_EMAIL_SIGNIN=false`.
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
        setMsg('Account created. You can sign in now.');
        setMode('sign-in');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/dashboard';
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-gray-50">
      <div className="w-[400px] rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">GEI Inventory</h1>
        <p className="mb-6 text-sm text-gray-600">Sign in to continue.</p>

        <Button className="w-full" onClick={onGoogle}>
          Sign in with Google
        </Button>

        {enableEmail && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-gray-500">
              <Separator className="flex-1" />
              <span>or</span>
              <Separator className="flex-1" />
            </div>

            <form onSubmit={onEmail} className="space-y-3">
              <div className="space-y-1">
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
              <div className="space-y-1">
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
                {mode === 'sign-up' ? 'Create account' : 'Sign in with email'}
              </Button>
            </form>

            <p className="mt-3 text-center text-xs text-gray-500">
              {mode === 'sign-in' ? (
                <>
                  New here?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('sign-up')}
                    className="text-blue-600 hover:underline"
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
                    className="text-blue-600 hover:underline"
                  >
                    Sign in instead
                  </button>
                </>
              )}
            </p>
          </>
        )}

        {msg && (
          <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
            {msg}
          </div>
        )}
      </div>
    </main>
  );
}
