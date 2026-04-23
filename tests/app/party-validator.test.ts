import { describe, it, expect } from 'vitest';
import { partyCreateSchema } from '@/lib/validators/party';

describe('partyCreateSchema', () => {
  it('accepts a minimal valid party', () => {
    const result = partyCreateSchema.safeParse({ name: 'ABC', type: 'SUPPLIER' });
    expect(result.success).toBe(true);
  });

  it('accepts a valid 15-character GSTIN', () => {
    const result = partyCreateSchema.safeParse({
      name: 'ABC Corp',
      type: 'CONTRACTOR',
      gstin: '29ABCDE1234F1Z5',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a 14-character GSTIN', () => {
    const result = partyCreateSchema.safeParse({
      name: 'ABC Corp',
      type: 'SUPPLIER',
      gstin: '29ABCDE1234F1Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const gstinError = result.error.issues.find((i) => i.path.includes('gstin'));
      expect(gstinError).toBeDefined();
    }
  });

  it('rejects an empty name', () => {
    const result = partyCreateSchema.safeParse({ name: '', type: 'SUPPLIER' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find((i) => i.path.includes('name'));
      expect(nameError).toBeDefined();
    }
  });

  it('rejects a missing type', () => {
    const result = partyCreateSchema.safeParse({ name: 'ABC Corp' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const typeError = result.error.issues.find((i) => i.path.includes('type'));
      expect(typeError).toBeDefined();
    }
  });

  it('accepts a valid short_code (2–8 uppercase alphanum)', () => {
    const result = partyCreateSchema.safeParse({
      name: 'ABC Corp',
      type: 'SUPPLIER',
      short_code: 'ABC12',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a null/absent short_code', () => {
    const a = partyCreateSchema.safeParse({ name: 'X', type: 'SUPPLIER' });
    const b = partyCreateSchema.safeParse({ name: 'X', type: 'SUPPLIER', short_code: null });
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
  });

  it('rejects a short_code shorter than 2 characters', () => {
    const result = partyCreateSchema.safeParse({
      name: 'X',
      type: 'SUPPLIER',
      short_code: 'A',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a short_code longer than 8 characters', () => {
    const result = partyCreateSchema.safeParse({
      name: 'X',
      type: 'SUPPLIER',
      short_code: 'ABCDEFGHI',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a short_code with lowercase letters', () => {
    const result = partyCreateSchema.safeParse({
      name: 'X',
      type: 'SUPPLIER',
      short_code: 'abc12',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a short_code with a hyphen', () => {
    const result = partyCreateSchema.safeParse({
      name: 'X',
      type: 'SUPPLIER',
      short_code: 'AB-12',
    });
    expect(result.success).toBe(false);
  });
});
