import { z } from 'zod';

/**
 * Zod schemas for `issues` (outward). Enforces the DB's
 * `chk_issue_destination` CHECK constraint at the app layer:
 * exactly one of (location_ref_id + optional party_id) OR
 * dest_site_id must be set.
 */
const baseFields = z.object({
  site_id: z.string().uuid(),
  item_id: z.string().uuid(),
  qty: z.coerce.number().refine((v) => v !== 0, 'Qty cannot be 0'),
  unit: z.string().min(1),
  // `worker_id` is the post-workforce recipient pointer.
  // `issued_to_legacy` is the pre-workforce free-text name, retained for
  // sites that have no workers registered yet. One of the two must be
  // set (matches the DB's chk_issue_recipient CHECK).
  worker_id: z.string().uuid().nullable().optional(),
  issued_to_legacy: z.string().max(120).nullable().optional(),
  issue_date: z.string().optional(),
  remarks: z.string().max(500).nullable().optional(),
  rate: z.coerce.number().nonnegative().nullable().optional(),
});

/**
 * Destination is a discriminated union that maps exactly to
 * `chk_issue_destination`:
 *   - `location` → sets location_ref_id (+ optional party_id)
 *   - `party`    → sets party_id (standalone, no location)
 *   - `site`     → sets dest_site_id (mutually exclusive with others)
 */
const locationDest = z.object({
  destinationKind: z.literal('location'),
  location_ref_id: z.string().uuid(),
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

export const issueCreateSchema = z
  .discriminatedUnion('destinationKind', [
    locationDest.merge(baseFields),
    partyDest.merge(baseFields),
    siteDest.merge(baseFields),
  ])
  .refine(
    (v) =>
      (v.worker_id !== null && v.worker_id !== undefined) ||
      (typeof v.issued_to_legacy === 'string' && v.issued_to_legacy.trim().length > 0),
    {
      message: 'Either a worker or a legacy issued-to name must be provided',
      path: ['worker_id'],
    },
  );

export type IssueCreate = z.infer<typeof issueCreateSchema>;
