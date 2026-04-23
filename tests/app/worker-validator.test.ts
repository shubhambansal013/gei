import { describe, it, expect } from 'vitest';
import {
  workerCreateSchema,
  workerUpdateSchema,
  workerTransferSchema,
  workerAffiliationChangeSchema,
} from '@/lib/validators/worker';

describe('workerCreateSchema', () => {
  const validUuid = '11111111-1111-4111-8111-111111111111';

  it('accepts a minimal DIRECT worker with name + site + type', () => {
    const res = workerCreateSchema.safeParse({
      full_name: 'Ramesh Kumar',
      current_site_id: validUuid,
      employment_type: 'DIRECT',
    });
    expect(res.success).toBe(true);
  });

  it('accepts CONTRACTOR_EMPLOYEE with a contractor party', () => {
    const res = workerCreateSchema.safeParse({
      full_name: 'Suresh Patel',
      current_site_id: validUuid,
      employment_type: 'CONTRACTOR_EMPLOYEE',
      contractor_party_id: validUuid,
    });
    expect(res.success).toBe(true);
  });

  it('accepts SUBCONTRACTOR_LENT with a contractor party', () => {
    const res = workerCreateSchema.safeParse({
      full_name: 'Deepak Singh',
      current_site_id: validUuid,
      employment_type: 'SUBCONTRACTOR_LENT',
      contractor_party_id: validUuid,
    });
    expect(res.success).toBe(true);
  });

  it('rejects DIRECT with a contractor_party_id set', () => {
    const res = workerCreateSchema.safeParse({
      full_name: 'Ramesh',
      current_site_id: validUuid,
      employment_type: 'DIRECT',
      contractor_party_id: validUuid,
    });
    expect(res.success).toBe(false);
  });

  it('rejects CONTRACTOR_EMPLOYEE without a contractor_party_id', () => {
    const res = workerCreateSchema.safeParse({
      full_name: 'Ramesh',
      current_site_id: validUuid,
      employment_type: 'CONTRACTOR_EMPLOYEE',
    });
    expect(res.success).toBe(false);
  });

  it('rejects SUBCONTRACTOR_LENT without a contractor_party_id', () => {
    const res = workerCreateSchema.safeParse({
      full_name: 'Ramesh',
      current_site_id: validUuid,
      employment_type: 'SUBCONTRACTOR_LENT',
    });
    expect(res.success).toBe(false);
  });

  it('rejects an empty full_name', () => {
    const res = workerCreateSchema.safeParse({
      full_name: '',
      current_site_id: validUuid,
      employment_type: 'DIRECT',
    });
    expect(res.success).toBe(false);
  });

  it('rejects an invalid site UUID', () => {
    const res = workerCreateSchema.safeParse({
      full_name: 'X',
      current_site_id: 'not-a-uuid',
      employment_type: 'DIRECT',
    });
    expect(res.success).toBe(false);
  });

  it('accepts optional phone + home_city', () => {
    const res = workerCreateSchema.safeParse({
      full_name: 'Ramesh',
      current_site_id: validUuid,
      employment_type: 'DIRECT',
      phone: '9876543210',
      home_city: 'Patna',
    });
    expect(res.success).toBe(true);
  });

  it('rejects an unknown employment_type', () => {
    const res = workerCreateSchema.safeParse({
      full_name: 'Ramesh',
      current_site_id: validUuid,
      employment_type: 'FREELANCE',
    });
    expect(res.success).toBe(false);
  });
});

describe('workerUpdateSchema', () => {
  const validUuid = '11111111-1111-4111-8111-111111111111';

  it('accepts a rename with id + full_name', () => {
    const res = workerUpdateSchema.safeParse({
      id: validUuid,
      full_name: 'Ramesh K.',
    });
    expect(res.success).toBe(true);
  });

  it('rejects when id is missing', () => {
    const res = workerUpdateSchema.safeParse({ full_name: 'X' });
    expect(res.success).toBe(false);
  });
});

describe('workerTransferSchema', () => {
  // Zod v4 requires RFC-valid UUIDs (version nibble [1-8], variant [89ab]).
  const uuid = (n: number) =>
    `${'1'.repeat(8)}-${'1'.repeat(4)}-4${'1'.repeat(3)}-8${'1'.repeat(3)}-${String(n).padStart(12, '0')}`;

  it('accepts a valid transfer payload', () => {
    const res = workerTransferSchema.safeParse({
      worker_id: uuid(1),
      to_site_id: uuid(2),
      effective_from: '2026-04-23',
      reason: 'Project reassignment',
    });
    expect(res.success).toBe(true);
  });

  it('rejects a blank reason', () => {
    const res = workerTransferSchema.safeParse({
      worker_id: uuid(1),
      to_site_id: uuid(2),
      effective_from: '2026-04-23',
      reason: '',
    });
    expect(res.success).toBe(false);
  });

  it('rejects a malformed effective_from date', () => {
    const res = workerTransferSchema.safeParse({
      worker_id: uuid(1),
      to_site_id: uuid(2),
      effective_from: '23-04-2026',
      reason: 'r',
    });
    expect(res.success).toBe(false);
  });
});

describe('workerAffiliationChangeSchema', () => {
  // Zod v4 requires RFC-valid UUIDs (version nibble [1-8], variant [89ab]).
  const uuid = (n: number) =>
    `${'1'.repeat(8)}-${'1'.repeat(4)}-4${'1'.repeat(3)}-8${'1'.repeat(3)}-${String(n).padStart(12, '0')}`;

  it('accepts DIRECT without contractor party', () => {
    const res = workerAffiliationChangeSchema.safeParse({
      worker_id: uuid(1),
      employment_type: 'DIRECT',
      effective_from: '2026-04-23',
    });
    expect(res.success).toBe(true);
  });

  it('accepts CONTRACTOR_EMPLOYEE with contractor party', () => {
    const res = workerAffiliationChangeSchema.safeParse({
      worker_id: uuid(1),
      employment_type: 'CONTRACTOR_EMPLOYEE',
      contractor_party_id: uuid(2),
      effective_from: '2026-04-23',
    });
    expect(res.success).toBe(true);
  });

  it('rejects DIRECT with a contractor party', () => {
    const res = workerAffiliationChangeSchema.safeParse({
      worker_id: uuid(1),
      employment_type: 'DIRECT',
      contractor_party_id: uuid(2),
      effective_from: '2026-04-23',
    });
    expect(res.success).toBe(false);
  });

  it('rejects non-DIRECT without a contractor party', () => {
    const res = workerAffiliationChangeSchema.safeParse({
      worker_id: uuid(1),
      employment_type: 'SUBCONTRACTOR_LENT',
      effective_from: '2026-04-23',
    });
    expect(res.success).toBe(false);
  });
});
