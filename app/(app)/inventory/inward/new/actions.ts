'use server';
import { runAction } from '@/lib/actions/shared';
import { purchaseCreateSchema } from '@/lib/validators/purchase';
import { revalidatePath } from 'next/cache';
import type { Database } from '@/lib/supabase/types';

type PurchaseInsert = Database['public']['Tables']['purchases']['Insert'];

/**
 * Creates a purchase (inward) row. Defaults `receipt_date` to today
 * and trims empty strings to null so Zod's optionals don't collide
 * with Supabase's exactOptionalPropertyTypes. Revalidates the
 * transactions list so the new row appears without a hard refresh.
 */
export async function createPurchase(raw: unknown) {
  const res = await runAction(purchaseCreateSchema, raw, async (input, sb) => {
    const payload: PurchaseInsert = {
      site_id: input.site_id,
      item_id: input.item_id,
      received_qty: input.received_qty,
      received_unit: input.received_unit,
      stock_unit: input.stock_unit,
      unit_conv_factor: input.unit_conv_factor,
      receipt_date: input.receipt_date ?? new Date().toISOString().slice(0, 10),
      rate: input.rate ?? null,
      vendor_id: input.vendor_id ?? null,
      invoice_no: input.invoice_no ?? null,
      invoice_date: input.invoice_date ?? null,
      hsn_sac: input.hsn_sac ?? null,
      supplier_part_no: input.supplier_part_no ?? null,
      manufacturer: input.manufacturer ?? null,
      remarks: input.remarks ?? null,
    };
    const { data, error } = await sb.from('purchases').insert(payload).select().single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) {
    revalidatePath('/inventory/transactions');
    revalidatePath('/dashboard');
  }
  return res;
}
