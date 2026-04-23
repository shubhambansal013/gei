import { describe, it, expect } from 'vitest';
import { siteCreateSchema, siteUpdateSchema } from '@/lib/validators/site';

describe('siteCreateSchema', () => {
  it('accepts a valid site with required fields', () => {
    const result = siteCreateSchema.safeParse({
      code: 'RGIPT-SIV',
      name: 'RGIPT Sivasagar',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a code that contains a space', () => {
    const result = siteCreateSchema.safeParse({
      code: 'RGIPT SIV',
      name: 'RGIPT Sivasagar',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const first = result.error.issues.at(0);
      expect(first?.message).toMatch(/letters, digits, or dash/i);
    }
  });

  it('rejects when name is missing', () => {
    const result = siteCreateSchema.safeParse({ code: 'RGIPT-SIV' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain('name');
    }
  });

  it('accepts optional type and address fields', () => {
    const result = siteCreateSchema.safeParse({
      code: 'RGIPT-SIV',
      name: 'RGIPT Sivasagar',
      type: 'hostel',
      address: '123 Main Road, Sivasagar, Assam',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('hostel');
      expect(result.data.address).toBe('123 Main Road, Sivasagar, Assam');
    }
  });

  it('accepts when type and address are omitted', () => {
    const result = siteCreateSchema.safeParse({
      code: 'HQ-DEL',
      name: 'HQ Delhi',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBeUndefined();
      expect(result.data.address).toBeUndefined();
    }
  });
});

describe('siteUpdateSchema', () => {
  it('requires id and reason on update', () => {
    const result = siteUpdateSchema.safeParse({
      id: 'not-a-uuid',
      name: 'Updated name',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain('id');
    }
  });

  it('rejects an empty reason on update', () => {
    const result = siteUpdateSchema.safeParse({
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      name: 'Updated name',
      reason: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const reasonIssue = result.error.issues.find((i) => i.path[0] === 'reason');
      expect(reasonIssue).toBeDefined();
    }
  });

  it('accepts a valid update payload', () => {
    const result = siteUpdateSchema.safeParse({
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      name: 'Updated name',
      reason: 'Correcting typo in site name',
    });
    expect(result.success).toBe(true);
  });
});
