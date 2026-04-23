import { z } from 'zod';

/**
 * Zod schemas for the `units` master (e.g. KG, MTR, NOS). The schema
 * mirrors the three columns in `schema.sql`:
 *   - `id`     — uppercase symbol that doubles as PK. Typed by admins,
 *                so we constrain the shape aggressively.
 *   - `label`  — human-readable name shown in dropdowns.
 *   - `category` — optional bucket (weight/length/volume/area/count).
 *                 Constrained to the seeded set so UI filters stay sane.
 *
 * Updates require a reason to keep the admin audit-trail intent
 * consistent with other masters, even though `units` does not (yet)
 * have a DB-level audit trigger.
 */

export const UNIT_CATEGORIES = ['weight', 'length', 'volume', 'area', 'count'] as const;
export type UnitCategory = (typeof UNIT_CATEGORIES)[number];

export const unitCreateSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(16)
    .regex(/^[A-Z0-9_]+$/, 'Symbol must be uppercase letters, digits, or underscore'),
  label: z.string().min(1).max(80),
  category: z.enum(UNIT_CATEGORIES).nullable().optional(),
});

export const unitUpdateSchema = unitCreateSchema.partial().extend({
  id: z
    .string()
    .min(1)
    .max(16)
    .regex(/^[A-Z0-9_]+$/, 'Symbol must be uppercase letters, digits, or underscore'),
  reason: z.string().min(1, 'A reason is required for every edit'),
});

export type UnitCreate = z.infer<typeof unitCreateSchema>;
export type UnitUpdate = z.infer<typeof unitUpdateSchema>;
