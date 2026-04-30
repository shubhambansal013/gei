import { z } from 'zod';

/**
 * Zod schemas for `issues` (outward). Enforces the DB's
 * `chk_issue_destination` CHECK constraint at the app layer:
 * exactly one of (location_unit_id + optional party_id) OR
 * dest_site_id must be set.
 */
const baseFields = z.object({
  site_id: z.string().uuid(),
  item_id: z.string().uuid(),
  qty: z.coerce.number().refine((v) => v !== 0, 'Qty cannot be 0'),
  unit: z.string().min(1),
  // `worker_id` is the recipient pointer.
  worker_id: z.string().uuid(),
  issue_date: z.string().optional(),
  remarks: z.string().max(500).nullable().optional(),
  rate: z.coerce.number().nonnegative().nullable().optional(),
});

/**
 * Destination is a discriminated union that maps exactly to
 * `chk_issue_destination`:
 *   - `location` → sets location_unit_id (+ optional party_id)
 *   - `party`    → sets party_id (standalone, no location)
 *   - `site`     → sets dest_site_id (mutually exclusive with others)
 */
const locationDest = z.object({
  destinationKind: z.literal('location'),
  location_unit_id: z.string().uuid(),
  party_id: z.string().uuid().nullable().optional(),
});
const partyDest = z.object({
  destinationKind: z.literal('party'),
  party_id: z.string().uuid(),
});
const siteDest = z.object({
  destinationKind: z.literal('site'),
  dest_site_id: z.string().uuid(),
});

export const issueCreateSchema = z.discriminatedUnion('destinationKind', [
  locationDest.merge(baseFields),
  partyDest.merge(baseFields),
  siteDest.merge(baseFields),
]);

export type IssueCreate = z.infer<typeof issueCreateSchema>;
