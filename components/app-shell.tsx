'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SiteSwitcher } from './site-switcher';
import { Button } from '@/components/ui/button';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  List,
  ArrowDownToLine,
  ArrowUpFromLine,
  Grid3x3,
  Package,
  Users2,
  HardHat,
  Building2,
  MapPin,
  UserCog,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inventory/transactions', label: 'Transactions', icon: List },
  { href: '/inventory/inward/new', label: 'Inward', icon: ArrowDownToLine },
  { href: '/inventory/outward/new', label: 'Outward', icon: ArrowUpFromLine },
  { href: '/inventory/pivot', label: 'Pivot', icon: Grid3x3 },
  { href: '/masters/items', label: 'Items', icon: Package },
  { href: '/masters/parties', label: 'Parties', icon: Users2 },
  { href: '/masters/workers', label: 'Workers', icon: HardHat },
  { href: '/masters/sites', label: 'Sites', icon: Building2 },
  { href: '/masters/locations', label: 'Locations', icon: MapPin },
  { href: '/masters/users', label: 'Users', icon: UserCog },
] as const;

/**
 * Persistent chrome for all signed-in routes.
 *
 * - Top bar: GEI wordmark + site switcher (left), sign-out (right).
 * - Sidebar: primary nav with icons. Active route gets the amber
 *   accent + a left border.
 * - Both header and sidebar carry `print:hide` so browser-print on any
 *   table page outputs only the data.
 *
 * Auth routes (`/login`, `/pending`) skip this shell — they sit under
 * `app/(auth)/` which has no layout beyond the root.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    window.location.assign('/login');
  };

  return (
    <div className="bg-muted/30 flex min-h-screen flex-col">
      <header className="print:hide bg-card sticky top-0 z-30 flex h-12 items-center justify-between border-b px-4">
        <div className="flex items-center gap-5">
          <Link href="/dashboard" className="flex items-baseline gap-1.5">
            <span className="text-primary font-mono text-base font-bold tracking-tight">GEI</span>
            <span className="text-muted-foreground text-xs font-medium">inventory</span>
          </Link>
          <SiteSwitcher />
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </header>

      <div className="flex flex-1">
        <nav className="print:hide bg-card w-52 shrink-0 border-r py-2">
          {NAV.map((i) => {
            const active =
              pathname === i.href || (i.href !== '/dashboard' && pathname?.startsWith(i.href));
            const Icon = i.icon;
            return (
              <Link
                key={i.href}
                href={i.href}
                className={cn(
                  'mx-2 flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span>{i.label}</span>
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
