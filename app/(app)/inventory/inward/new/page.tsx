export const dynamic = "force-dynamic";

import { supabaseServer } from '@/lib/supabase/server';
import { PurchaseForm } from './inward-form';
import { EmptyState } from '@/components/empty-state';

/**
 * Goods-received entry screen. Loads the current user's accessible
 * sites + all items + suppliers in parallel, then renders the form.
 *
 * Site selection: we pick the first accessible site as default, same
 * as the SiteSwitcher does. A future improvement passes the
 * user-selected site from the Zustand store via a client wrapper.
 */
export default async function PurchaseNewPage() {
  const sb = await supabaseServer();
  const [{ data: sites }, { data: items }, { data: parties }, { data: units }] = await Promise.all([
    sb.from('sites').select('id, name, code').order('name'),
    sb.from('items').select('id, name, code, stock_unit').order('code'),
    sb.from('parties').select('id, name, type').eq('type', 'SUPPLIER').order('name'),
    sb.from('units').select('id, label, category').order('label'),
  ]);

  if (!sites || sites.length === 0) {
    return (
      <EmptyState
        title="No accessible sites"
        description="Ask an admin for site access before recording a purchase."
      />
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">New purchase</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Record goods received from a supplier. Fields marked * are required.
        </p>
      </header>
      <PurchaseForm
        sites={sites}
        items={items ?? []}
        suppliers={parties ?? []}
        units={units ?? []}
      />
    </div>
  );
}
