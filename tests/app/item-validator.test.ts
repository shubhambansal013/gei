import { describe, it, expect } from 'vitest';
import { itemCreateSchema, itemUpdateSchema } from '@/lib/validators/item';

describe('itemCreateSchema', () => {
  it('accepts a valid item with name, code, and stock_unit', () => {
    const result = itemCreateSchema.safeParse({
      name: 'Portland Cement 53 Grade',
      code: 'CEM-53',
      stock_unit: 'MT',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a code that contains a space', () => {
    const result = itemCreateSchema.safeParse({
      name: 'Steel Rod',
      code: 'has space',
      stock_unit: 'MT',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when stock_unit is missing', () => {
    const result = itemCreateSchema.safeParse({
      name: 'Steel Rod',
      code: 'STEEL-ROD',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty stock_unit after trim', () => {
    const result = itemCreateSchema.safeParse({
      name: 'Steel Rod',
      code: 'STEEL-ROD',
      stock_unit: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a stock_unit longer than 16 chars', () => {
    const result = itemCreateSchema.safeParse({
      name: 'Steel Rod',
      code: 'STEEL-ROD',
      stock_unit: 'x'.repeat(17),
    });
    expect(result.success).toBe(false);
  });

  it('trims whitespace around stock_unit', () => {
    const result = itemCreateSchema.safeParse({
      name: 'Steel Rod',
      code: 'STEEL-ROD',
      stock_unit: '  MT  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stock_unit).toBe('MT');
    }
  });

  it('defaults category_id to ELECTRICAL if not provided', () => {
    const result = itemCreateSchema.safeParse({
      name: 'Generic Wire',
      code: 'WIRE-001',
      stock_unit: 'MTR',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category_id).toBe('ELECTRICAL');
    }
  });

  it('coerces string reorder_level "10" to number 10', () => {
    const result = itemCreateSchema.safeParse({
      name: 'River Sand',
      code: 'SAND',
      stock_unit: 'CUM',
      reorder_level: '10',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reorder_level).toBe(10);
    }
  });
});

describe('itemUpdateSchema', () => {
  const sampleId = '11111111-1111-4111-8111-111111111111';

  it('requires a non-empty reason for every edit', () => {
    const result = itemUpdateSchema.safeParse({
      id: sampleId,
      name: 'Updated',
      reason: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a partial update with a reason', () => {
    const result = itemUpdateSchema.safeParse({
      id: sampleId,
      stock_unit: 'KG',
      reason: 'Correcting stock unit after catalog review',
    });
    expect(result.success).toBe(true);
  });
});
