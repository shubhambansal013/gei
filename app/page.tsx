import { redirect } from 'next/navigation';

/**
 * Root route — always forwards to the dashboard. Unauthenticated
 * traffic never reaches this component because `middleware.ts`
 * redirects it to `/login` first.
 */
export default function Home() {
  redirect('/dashboard');
}
