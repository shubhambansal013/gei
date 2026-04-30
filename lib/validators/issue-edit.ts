import { z } from 'zod';

/**
 * Partial-update schema for issues (outward). Destination changes are
 * deliberately NOT exposed here — if the destination is wrong, the
 * correct action is a soft-delete + re-entry, not an in-place edit.
 */
export const issueEditSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(1, 'A reason is required for every edit'),
  qty: z.coerce
    .number()
    .refine((v) => v !== 0, 'Qty cannot be 0')
    .optional(),
  // Structured pointer to the recipient worker.
  worker_id: z.string().uuid().nullable().optional(),
  remarks: z.string().max(500).nullable().optional(),
  rate: z.coerce.number().nonnegative().nullable().optional(),
});
export type IssueEdit = z.infer<typeof issueEditSchema>;

export const issueSoftDeleteSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(1, 'A reason is required for every delete'),
});
