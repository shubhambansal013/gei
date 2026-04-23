import { z } from 'zod';

/**
 * Zod schemas for the workforce aggregate.
 *
 * Domain shape (see migration 20260423000005_workforce.sql):
 *
 *   Worker ─┬─ 1..1 open WorkerSiteAssignment  (current placement)
 *           └─ 1..1 open WorkerAffiliation     (current employment)
 *
 *   employment_type ∈ {DIRECT, CONTRACTOR_EMPLOYEE, SUBCONTRACTOR_LENT}
 *
 *   Rule: non-DIRECT requires `contractor_party_id`; DIRECT forbids it.
 *   The same rule lives as a DB CHECK on `worker_affiliations`; we also
 *   enforce it here so the form surfaces the mistake before round-trip.
 *
 * `code` (W-0001) is minted by a BEFORE INSERT trigger — clients never
 * supply it, so it's absent from every schema below.
 */

export const EMPLOYMENT_TYPES = ['DIRECT', 'CONTRACTOR_EMPLOYEE', 'SUBCONTRACTOR_LENT'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

const employmentTypeSchema = z.enum(EMPLOYMENT_TYPES);

/** YYYY-MM-DD. Matches Postgres `DATE` wire format. */
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

/**
 * Cross-field rule: DIRECT ⇔ no contractor_party_id, everything else ⇔
 * contractor_party_id required. Shared by create + affiliation-change.
 */
function affiliationPartyRule<
  T extends { employment_type: EmploymentType; contractor_party_id?: string | null | undefined },
>(schema: z.ZodType<T>): z.ZodType<T> {
  return schema.refine(
    (v) => {
      if (v.employment_type === 'DIRECT') {
        return v.contractor_party_id === null || v.contractor_party_id === undefined;
      }
      return typeof v.contractor_party_id === 'string' && v.contractor_party_id.length > 0;
    },
    {
      message:
        'DIRECT workers must not have a contractor party; CONTRACTOR_EMPLOYEE / SUBCONTRACTOR_LENT must.',
      path: ['contractor_party_id'],
    },
  );
}

/**
 * Worker create. Opens the first SiteAssignment + Affiliation atomically
 * in the server action — the validator captures the worker itself plus
 * the intent of the opening affiliation.
 */
const workerCreateBase = z.object({
  full_name: z.string().min(1, 'Name is required').max(120),
  phone: z.string().max(20).nullable().optional(),
  home_city: z.string().max(80).nullable().optional(),
  current_site_id: z.string().uuid(),
  employment_type: employmentTypeSchema,
  contractor_party_id: z.string().uuid().nullable().optional(),
});

export const workerCreateSchema = affiliationPartyRule(workerCreateBase);

/**
 * Worker edit. Identity (code, site, employment) is NOT changed here —
 * that flows through `transfer` and `changeAffiliation` actions so the
 * DB history tables catch the transition. Only name/phone/city/is_active
 * are in-place editable.
 */
export const workerUpdateSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(1).max(120).optional(),
  phone: z.string().max(20).nullable().optional(),
  home_city: z.string().max(80).nullable().optional(),
  is_active: z.boolean().optional(),
});

/**
 * Transfer — closes the current SiteAssignment, opens a new one, and
 * updates `workers.current_site_id`. Atomic in the server action.
 */
export const workerTransferSchema = z.object({
  worker_id: z.string().uuid(),
  to_site_id: z.string().uuid(),
  effective_from: dateSchema,
  reason: z.string().min(1, 'A reason is required').max(200),
});

/**
 * Change affiliation — e.g. a SUBCONTRACTOR_LENT worker becomes DIRECT.
 * Closes the current Affiliation and opens a new one, atomically.
 */
const workerAffiliationChangeBase = z.object({
  worker_id: z.string().uuid(),
  employment_type: employmentTypeSchema,
  contractor_party_id: z.string().uuid().nullable().optional(),
  effective_from: dateSchema,
});

export const workerAffiliationChangeSchema = affiliationPartyRule(workerAffiliationChangeBase);

export type WorkerCreate = z.infer<typeof workerCreateSchema>;
export type WorkerUpdate = z.infer<typeof workerUpdateSchema>;
export type WorkerTransfer = z.infer<typeof workerTransferSchema>;
export type WorkerAffiliationChange = z.infer<typeof workerAffiliationChangeSchema>;
