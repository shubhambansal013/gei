'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SiteSwitcher } from './site-switcher';
import { Button } from '@/components/ui/button';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { createCan } from '@/lib/permissions/can';
import { useSiteStore } from '@/lib/stores/site';
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
  Ruler,
  ShieldCheck,
  BarChart3,
  Menu,
  X,
} from 'lucide-react';
import type { ModuleId, ActionId } from '@/lib/permissions/types';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  module?: ModuleId;
  action?: ActionId;
  adminOnly?: boolean;
};

const NAV_GROUPS: { label?: string; items: NavItem[] }[] = [
  { items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Inventory',
    items: [
      { href: '/inventory/outward/new', label: 'Issue', icon: ArrowUpFromLine, module: 'INVENTORY', action: 'CREATE' },
      { href: '/inventory/inward/new', label: 'Purchase', icon: ArrowDownToLine, module: 'INVENTORY', action: 'CREATE' },
      { href: '/inventory/transactions', label: 'Transactions', icon: List, module: 'INVENTORY', action: 'VIEW' },
      { href: '/masters/items', label: 'Items', icon: Package, module: 'INVENTORY', action: 'VIEW' },
      {
        href: '/masters/units',
        label: 'Units',
        icon: Ruler,
        module: 'INVENTORY',
        action: 'VIEW',
        adminOnly: true,
      },
    ],
  },
  {
    label: 'Masters',
    items: [
      {
        href: '/masters/parties',
        label: 'Parties',
        icon: Users2,
        module: 'INVENTORY',
        action: 'VIEW',
        adminOnly: true,
      },
      { href: '/masters/workers', label: 'Workers', icon: HardHat, module: 'WORKERS', action: 'VIEW' },
      { href: '/masters/sites', label: 'Sites', icon: Building2, adminOnly: true },
      {
        href: '/masters/locations',
        label: 'Locations',
        icon: MapPin,
        module: 'LOCATION',
        action: 'VIEW',
        adminOnly: true,
      },
      { href: '/masters/role-permissions', label: 'Role permissions', icon: ShieldCheck, adminOnly: true },
      { href: '/masters/users', label: 'Users', icon: UserCog, adminOnly: true },
    ],
  },
  {
    label: 'Reports',
    items: [
      { href: '/reports/items', label: 'Item-wise stock', icon: BarChart3, module: 'REPORTS', action: 'VIEW' },
      { href: '/reports/consumption-pivot', label: 'Consumption Pivot', icon: Grid3x3, module: 'REPORTS', action: 'VIEW' },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/**
 * Persistent chrome for all signed-in routes.
 *
 * - Top bar: GEI wordmark + site switcher (left), sign-out (right). On
 * mobile, a hamburger button opens the sidebar as a slide-in drawer.
 * - Sidebar: primary nav with icons. Active route gets the amber accent.
 * On mobile (< md), the sidebar is hidden by default and rendered as a
 * drawer with a backdrop. On desktop (md+), it sits beside the main
 * content as before. Nav items carry a 44px minimum touch target so
 * they are comfortable on low-end phones.
 * - Both header and sidebar carry `print:hide` so browser-print on any
 * table page outputs only the data.
 *
 * Auth routes (`/login`, `/pending`) skip this shell — they sit under
 * `app/(auth)/` which has no layout beyond the root.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentSite } = useSiteStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const canFn = useMemo(() => createCan(supabaseBrowser()), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = supabaseBrowser();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user || !alive) return;

      const { data: profile } = await sb
        .from('profiles')
        .select('role_id')
        .eq('id', user.id)
        .single();

      if (profile && alive) {
        setUserRole(profile.role_id);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!currentSite?.id) return;

    const checks = ALL_NAV_ITEMS
      .filter((i) => i.module && i.action)
      .map((i) => ({ module: i.module!, action: i.action! }));

    // Distinct checks to avoid redundant RPCs
    const distinct = Array.from(new Set(checks.map((c) => `${c.module}:${c.action}`))).map((s) => {
      const [module, action] = s.split(':') as [ModuleId, ActionId];
      return { module, action };
    });

    let alive = true;
    Promise.all(
      distinct.map(async ({ module, action }) => {
        const allowed = await canFn({ siteId: currentSite.id, module, action });
        return { key: `${module}:${action}`, allowed };
      }),
    ).then((results) => {
      if (!alive) return;
      const next = results.reduce(
        (acc, r) => ({ ...acc, [r.key]: r.allowed }),
        {} as Record<string, boolean>,
      );
      setPermissions(next);
    });

    return () => {
      alive = false;
    };
  }, [currentSite?.id, canFn]);

  const isVisible = useCallback(
    (item: NavItem) => {
      if (item.adminOnly) {
        if (!userRole) return false;
        return userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
      }
      if (!item.module || !item.action) return true;
      return permissions[`${item.module}:${item.action}`] ?? false;
    },
    [permissions, userRole],
  );

  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    window.location.assign('/login');
  };

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // ESC to close + focus management when drawer is open on mobile.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    closeBtnRef.current?.focus();
    // Prevent body scroll while the drawer occupies the viewport.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  return (
    <div className="bg-muted/30 flex min-h-screen flex-col">
      <header className="print:hide bg-card sticky top-0 z-30 flex h-12 items-center justify-between border-b px-3 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            aria-controls="app-nav"
            className="min-h-11 min-w-11 md:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </Button>
          <Link href="/dashboard" aria-label="GEI home" className="flex items-baseline gap-1.5">
            <span className="text-primary font-mono text-base font-bold tracking-tight">GEI</span>
          </Link>
          <SiteSwitcher />
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="min-h-11 md:h-8">
          Sign out
        </Button>
      </header>

      <div className="flex flex-1">
        {/*
          Mobile drawer backdrop. Rendered only when open; click dismisses.
          Desktop (md+) hides both backdrop and drawer positioning so the
          sidebar renders inline.
        */}
        {drawerOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={closeDrawer}
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
          />
        )}

        <nav
          id="app-nav"
          aria-label="Primary"
          className={cn(
            'print:hide bg-card shrink-0 border-r overflow-y-auto',
            // Mobile: fixed slide-in drawer.
            'fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ease-out',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
            // Desktop: sticky 52-unit sidebar, no transform.
            'md:sticky md:top-12 md:h-[calc(100vh-3rem)] md:z-auto md:w-52 md:translate-x-0 md:transition-none',
          )}
        >
          <div className="flex h-12 items-center justify-between border-b px-3 md:hidden">
            <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Menu
            </span>
            <Button
              ref={closeBtnRef}
              type="button"
              variant="ghost"
              size="icon"
              onClick={closeDrawer}
              aria-label="Close navigation"
              className="min-h-11 min-w-11"
            >
              <X className="h-5 w-5" aria-hidden />
            </Button>
          </div>
          
          <SidebarNav 
            groups={NAV_GROUPS} 
            pathname={pathname} 
            isVisible={isVisible} 
            onNavigate={closeDrawer} 
          />
        </nav>

        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function SidebarNav({ 
  groups, 
  pathname, 
  isVisible, 
  onNavigate 
}: { 
  groups: typeof NAV_GROUPS;
  pathname: string | null;
  isVisible: (i: NavItem) => boolean;
  onNavigate: () => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5 py-2" role="list">
      {groups.map((group, idx) => {
        const visibleItems = group.items.filter(isVisible);
        if (visibleItems.length === 0) return null;

        return (
          <li key={idx}>
            {group.label && <NavSection label={group.label} />}
            {visibleItems.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </li>
        );
      })}
    </ul>
  );
}

function NavSection({ label }: { label: string }) {
  return (
    <div
      aria-hidden
      className="text-muted-foreground mt-2 px-4 pt-2 text-[10px] font-semibold tracking-wider uppercase"
    >
      {label}
    </div>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string | null;
  onNavigate: () => void;
}) {
  const active =
    pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      // 44px (min-h-11) touch target; visually unchanged on desktop.
      className={cn(
        'mx-2 flex min-h-11 items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm transition-colors md:min-h-8 md:py-1.5',
        active
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span>{item.label}</span>
    </Link>
  );
}
