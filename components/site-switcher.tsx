'use client';
import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useSiteStore } from '@/lib/stores/site';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Renders a dropdown of sites the user has access to. First load picks
 * the first site automatically if none is currently selected. Writes
 * the selection into the Zustand store; every page consumes the store
 * value to scope its queries.
 *
 * Sites come in through RLS: `sites_select_accessible` only returns
 * rows the user is SUPER_ADMIN globally or has `site_user_access` for.
 */
export function SiteSwitcher() {
  const { sites, currentSite, setSites, setCurrentSite } = useSiteStore();

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabaseBrowser().from('sites').select('id, name, code').order('name');
      if (!alive || !data) return;
      setSites(data);
      if (!currentSite && data[0]) setCurrentSite(data[0]);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!sites.length) return null;

  return (
    <Select
      value={currentSite?.id}
      onValueChange={(id) => {
        const s = sites.find((x) => x.id === id);
        if (s) setCurrentSite(s);
      }}
    >
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Select site" />
      </SelectTrigger>
      <SelectContent>
        {sites.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.code} — {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
