import { z } from 'zod';

/**
 * Zod schemas for `purchases` (inward). Mirrors the schema.sql table:
 *   - received_qty > 0, received_unit + stock_unit → units(id)
 *   - unit_conv_factor defaults to 1; stock_qty is generated
 *   - rate optional; total_amount is generated
 *   - receipt_date defaults to today
 */
export const purchaseCreateSchema = z.object({
  site_id: z.string().uuid(),
  item_id: z.string().uuid(),
  received_qty: z.coerce.number().positive(),
  received_unit: z.string().min(1),
  stock_unit: z.string().min(1),
  unit_conv_factor: z.coerce.number().positive().default(1),
  rate: z.coerce.number().nonnegative().nullable().optional(),
  vendor_id: z.string().uuid().nullable().optional(),
  invoice_no: z.string().max(40).nullable().optional(),
  invoice_date: z.string().nullable().optional(),
  receipt_date: z.string().optional(),
  hsn_sac: z.string().max(20).nullable().optional(),
  supplier_part_no: z.string().max(40).nullable().optional(),
  manufacturer: z.string().max(120).nullable().optional(),
  remarks: z.string().max(500).nullable().optional(),
});

export type PurchaseCreate = z.infer<typeof purchaseCreateSchema>;
