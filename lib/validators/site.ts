import { z } from 'zod';

/**
 * Zod schemas for the sites master. Mirrors the `sites` table in
 * `schema.sql`:
 *   - `code` is a short, unique, uppercase/dash identifier used in
 *     location resolution and URL scoping (e.g. RGIPT-SIV).
 *   - `type` is free-form (hostel, office, residential, ...).
 */
export const siteCreateSchema = z.object({
  name: z.string().min(1).max(120),
  code: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Z0-9-]+$/i, 'Site code must be letters, digits, or dash'),
  type: z.string().max(40).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
});

export const siteUpdateSchema = siteCreateSchema.partial().extend({
  id: z.string().uuid(),
  reason: z.string().min(1, 'A reason is required for every edit'),
});

export type SiteCreate = z.infer<typeof siteCreateSchema>;
export type SiteUpdate = z.infer<typeof siteUpdateSchema>;
