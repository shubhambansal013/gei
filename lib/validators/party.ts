import { z } from 'zod';

/**
 * Zod schemas for the parties master. Mirrors the `parties` table
 * in `schema.sql`:
 *   - `type` references `party_types.id` (SUPPLIER, CONTRACTOR, ...).
 *   - `short_code` is an optional, globally-unique 2–8 character
 *     alphanumeric identifier (uppercase) used for fast search/entry.
 *     Mirrors the `parties_short_code_fmt` CHECK and the unique partial
 *     index in migration 20260423000007.
 *   - GSTIN / phone / address are free-form optional strings.
 */
export const partyCreateSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.string().min(1),
  short_code: z
    .string()
    .regex(/^[A-Z0-9]{2,8}$/, 'Short code must be 2–8 uppercase letters or digits')
    .nullable()
    .optional(),
  gstin: z
    .string()
    .max(20)
    .regex(/^$|^[0-9A-Z]{15}$/, 'GSTIN must be blank or 15 characters')
    .nullable()
    .optional(),
  phone: z.string().max(20).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
});

export const partyUpdateSchema = partyCreateSchema.partial().extend({
  id: z.string().uuid(),
  reason: z.string().min(1, 'A reason is required for every edit'),
});

export type PartyCreate = z.infer<typeof partyCreateSchema>;
export type PartyUpdate = z.infer<typeof partyUpdateSchema>;
