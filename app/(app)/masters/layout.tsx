'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/masters/items', label: 'Items' },
  { href: '/masters/parties', label: 'Parties' },
  { href: '/masters/sites', label: 'Sites' },
  { href: '/masters/locations', label: 'Locations' },
];

/**
 * Shared chrome for all master-data screens. Renders the title and a
 * horizontal tab strip so admins can move between items / parties /
 * sites / locations without re-entering a context.
 */
export default function MastersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Masters</h1>
      <nav className="flex gap-1 border-b">
        {TABS.map((t) => {
          const active = pathname?.startsWith(t.href) ?? false;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
                active
                  ? 'border-primary text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <div>{children}</div>
    </div>
  );
}
