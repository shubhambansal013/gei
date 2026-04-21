'use client';
import Link from 'next/link';
import { SiteSwitcher } from './site-switcher';
import { Button } from '@/components/ui/button';
import { supabaseBrowser } from '@/lib/supabase/browser';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/inventory/transactions', label: 'Transactions' },
  { href: '/inventory/inward/new', label: '+ Inward' },
  { href: '/inventory/outward/new', label: '+ Outward' },
  { href: '/inventory/pivot', label: 'Pivot' },
  { href: '/masters/items', label: 'Masters' },
];

/**
 * Persistent app chrome for all signed-in routes. Top bar holds brand
 * + site switcher + sign-out. Sidebar lists primary navigation. Both
 * are marked `print:hide` so browser-print flows only render the
 * currently-visible table/report.
 *
 * Route segments that require this chrome sit under `app/(app)/`;
 * the login/pending screens live under `app/(auth)/` and skip the
 * shell entirely.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="print:hide flex items-center justify-between border-b bg-white px-4 py-2">
        <div className="flex items-center gap-4">
          <span className="font-semibold">GEI</span>
          <SiteSwitcher />
        </div>
        <Button variant="outline" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </header>

      <div className="flex flex-1">
        <nav className="print:hide w-52 border-r bg-gray-50 p-3 text-sm">
          {NAV.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className="block rounded px-2 py-1.5 hover:bg-gray-200"
            >
              {i.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 overflow-auto p-4">{children}</main>
      </div>
    </div>
  );
}
