export const dynamic = "force-dynamic";

import { supabaseServer } from '@/lib/supabase/server';
import { IssueForm } from './outward-form';
import { EmptyState } from '@/components/empty-state';

/**
 * The primary entry screen for site-store workers. Destination is
 * decomposed into Location + Party (either or both) with a separate
 * "Transfer to site" mode for cross-site stock moves. Issued-to flows
 * through WorkerPicker with inline create.
 */
export default async function IssueNewPage() {
  const sb = await supabaseServer();
  const [
    { data: sites },
    { data: items },
    { data: parties },
    { data: locations },
    { data: workers },
  ] = await Promise.all([
    sb.from('sites').select('id, name, code').order('name'),
    sb.from('items').select('id, name, code, stock_unit').order('code'),
    sb.from('parties').select('id, name, type, short_code').order('name'),
    sb.from('location_units').select('id, name, code, site_id').order('code'),
    sb
      .from('workers')
      .select(`
        id,
        code,
        full_name,
        current_site_id,
        worker_affiliations(
          employment_type,
          contractor:parties(name)
        )
      `)
      .eq('is_active', true)
      .is('worker_affiliations.effective_to', null)
      .order('full_name'),
  ]);

  if (!sites || sites.length === 0) {
    return (
      <EmptyState
        title="No accessible sites"
        description="Ask an admin for site access before recording an issue."
      />
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">New issue</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Issue material from stock. Pick an item, a quantity, and where it&rsquo;s going.
        </p>
      </header>
      <IssueForm
        sites={sites}
        items={items ?? []}
        parties={parties ?? []}
        locations={locations ?? []}
        workers={workers ?? []}
      />
    </div>
  );
}
