import { AppShell } from '@/components/app-shell';

/**
 * Wraps every signed-in route in the persistent chrome (top bar +
 * sidebar). The redirect-to-login for unauthenticated traffic is
 * handled in `middleware.ts`; by the time we render this layout, we
 * know the user has a valid session.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
