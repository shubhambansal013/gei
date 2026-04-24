import { z } from 'zod';

/** Zod schemas for the location-master tables. */

export const locationUnitCreateSchema = z.object({
  site_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(20),
  type: z.string().min(1),
});

export const locationUnitUpdateSchema = locationUnitCreateSchema.extend({
  id: z.string().uuid(),
  reason: z.string().min(1).max(200),
});

export type LocationUnitCreate = z.infer<typeof locationUnitCreateSchema>;
export type LocationUnitUpdate = z.infer<typeof locationUnitUpdateSchema>;
