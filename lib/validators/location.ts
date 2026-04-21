import { z } from 'zod';

/** Zod schemas for the location-master tables. */

export const locationTemplateCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
});

export const locationTemplateNodeCreateSchema = z.object({
  template_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(20),
  type: z.string().min(1),
  position: z.coerce.number().int().nullable().optional(),
});

export const locationUnitCreateSchema = z.object({
  site_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(20),
  type: z.string().min(1),
  template_id: z.string().uuid().nullable().optional(),
  position: z.coerce.number().int().nullable().optional(),
});

export type LocationTemplateCreate = z.infer<typeof locationTemplateCreateSchema>;
export type LocationTemplateNodeCreate = z.infer<typeof locationTemplateNodeCreateSchema>;
export type LocationUnitCreate = z.infer<typeof locationUnitCreateSchema>;
