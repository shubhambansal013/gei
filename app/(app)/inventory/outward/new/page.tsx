import { supabaseServer } from '@/lib/supabase/server';
import { IssueForm } from './outward-form';
import { EmptyState } from '@/components/empty-state';

/**
 * The core low-effort screen for site-store workers. Four fields:
 *   item · qty · destination · issued-to (optional)
 *
 * Loads items, parties, location_references, and external sites in
 * parallel, flattens them into a single grouped SearchableSelect so
 * the worker picks from ONE dropdown regardless of destination type.
 */
export default async function IssueNewPage() {
  const sb = await supabaseServer();
  const [{ data: sites }, { data: items }, { data: parties }, { data: locations }] =
    await Promise.all([
      sb.from('sites').select('id, name, code').order('name'),
      sb.from('items').select('id, name, code, stock_unit').order('code'),
      sb.from('parties').select('id, name, type').order('name'),
      sb.from('location_references').select('id, full_path, full_code, site_id').order('full_code'),
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
      />
    </div>
  );
}
