'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { createCan } from '@/lib/permissions/can';
import type { ModuleId, ActionId } from '@/lib/permissions/types';

const canFn = createCan(supabaseBrowser());

type Props = {
  siteId: string;
  module: ModuleId;
  action: ActionId;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

/**
 * Conditionally renders `children` based on the current user's
 * permission for `(siteId × module × action)`. Purely presentational —
 * the Postgres RLS policy that calls the same `can_user()` function
 * at the DB layer is the real trust boundary. This gate only hides
 * UI from users who wouldn't succeed anyway.
 *
 * Returns `null` while the permission check is in-flight to avoid a
 * flash of unauthorized UI. Use `fallback` to show a reason instead.
 */
export function PermissionGate({ siteId, module, action, children, fallback = null }: Props) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    canFn({ siteId, module, action }).then((a) => {
      if (alive) setAllowed(a);
    });
    return () => {
      alive = false;
    };
  }, [siteId, module, action]);
  if (allowed === null) return null;
  return <>{allowed ? children : fallback}</>;
}
