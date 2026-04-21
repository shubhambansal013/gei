import { z } from 'zod';

/**
 * Partial-update schema for purchases. Only fields that are safe to
 * edit without re-running the RLS + trigger dance are exposed here:
 * qty, rate, invoice_no, remarks. Every update requires a non-empty
 * `reason` string that flows into `app.edit_reason` so the audit
 * trigger captures it.
 */
export const purchaseEditSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(1, 'A reason is required for every edit'),
  received_qty: z.coerce.number().positive().optional(),
  rate: z.coerce.number().nonnegative().nullable().optional(),
  invoice_no: z.string().max(40).nullable().optional(),
  remarks: z.string().max(500).nullable().optional(),
});
export type PurchaseEdit = z.infer<typeof purchaseEditSchema>;

export const purchaseSoftDeleteSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(1, 'A reason is required for every delete'),
});
