import { describe, it, expect } from 'vitest';
import { itemCreateSchema } from '@/lib/validators/item';

describe('itemCreateSchema', () => {
  it('accepts a valid item with name, code, and unit', () => {
    const result = itemCreateSchema.safeParse({
      name: 'Portland Cement 53 Grade',
      code: 'CEM-53',
      unit: 'MT',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a code that contains a space', () => {
    const result = itemCreateSchema.safeParse({
      name: 'Steel Rod',
      code: 'has space',
      unit: 'MT',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when unit is missing', () => {
    const result = itemCreateSchema.safeParse({
      name: 'Steel Rod',
      code: 'STEEL-ROD',
    });
    expect(result.success).toBe(false);
  });

  it('coerces string reorder_level "10" to number 10', () => {
    const result = itemCreateSchema.safeParse({
      name: 'River Sand',
      code: 'SAND',
      unit: 'CUM',
      reorder_level: '10',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reorder_level).toBe(10);
    }
  });
});
