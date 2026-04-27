import { z } from 'zod';

/**
 * Zod schemas for the items master. Field names and constraints
 * mirror the `items` table in `schema.sql`:
 *   - `code` is a short uppercase identifier (the GEI_code), unique.
 *   - `stock_unit` is the canonical unit stock is tracked in (e.g.
 *     "meter", "kg"). It replaces the old `unit` column and is always
 *     recorded in the item master, never re-declared per purchase.
 *   - `reorder_level` is nullable; unset means "no low-stock alert".
 *
 * Updates require a non-empty `reason` because the audit trigger on
 * `items` (added later when the audit log extends to masters) will
 * need it for the `inventory_edit_log`-style ledger.
 */
const stockUnitSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(1, 'Stock unit is required')
      .max(16, 'Stock unit must be 16 characters or fewer'),
  );

export const itemCreateSchema = z.object({
  name: z.string().min(1).max(120),
  code: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[A-Z0-9_-]+$/i, 'Code must be letters, digits, dash, or underscore'),
  category_id: z.string().nullable().default('ELECTRICAL'),
  stock_unit: stockUnitSchema,
  hsn_code: z.string().max(20).nullable().optional(),
  reorder_level: z.coerce.number().nonnegative().nullable().optional(),
});

export const itemUpdateSchema = itemCreateSchema.partial().extend({
  id: z.string().uuid(),
  reason: z.string().min(1, 'A reason is required for every edit'),
});

export type ItemCreate = z.infer<typeof itemCreateSchema>;
export type ItemUpdate = z.infer<typeof itemUpdateSchema>;
