export const runtime = "edge";
import { supabaseServer } from '@/lib/supabase/server';
import { ItemsClient } from './items-client';

/**
 * Master items screen. Fetches items (with category join), categories, and
 * units in parallel; delegates all interactivity to `ItemsClient`.
 */
export default async function ItemsPage() {
  const sb = await supabaseServer();

  const [itemsResult, categoriesResult, unitsResult] = await Promise.all([
    sb
      .from('items')
      .select('*, category:item_categories(label)')
      .order('code', { ascending: true }),
    sb.from('item_categories').select('*').order('label', { ascending: true }),
    sb.from('units').select('*').order('label', { ascending: true }),
  ]);

  // Surface DB errors as a thrown error so Next.js error boundary catches it
  if (itemsResult.error) throw new Error(itemsResult.error.message);
  if (categoriesResult.error) throw new Error(categoriesResult.error.message);
  if (unitsResult.error) throw new Error(unitsResult.error.message);

  return (
    <ItemsClient
      items={itemsResult.data ?? []}
      categories={categoriesResult.data ?? []}
      units={unitsResult.data ?? []}
    />
  );
}
