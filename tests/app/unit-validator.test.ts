import { describe, it, expect } from 'vitest';
import { unitCreateSchema, unitUpdateSchema } from '@/lib/validators/unit';

/**
 * Validator contract for the `units` master. The underlying table is
 * reference data (`id`, `label`, `category`) seeded in schema.sql — no
 * conversion factors or numeric fields, so the schema stays small.
 *
 * The `id` is the human-typed symbol (e.g. `KG`, `MTR`). It doubles as
 * the stable primary key and the label shown in dropdowns, so we keep
 * it uppercase-alphanumeric with a small max length.
 */
describe('unitCreateSchema', () => {
  it('accepts a valid unit', () => {
    const result = unitCreateSchema.safeParse({
      id: 'KG',
      label: 'Kilogram',
      category: 'weight',
    });
    expect(result.success).toBe(true);
  });

  it('rejects when id is missing', () => {
    const result = unitCreateSchema.safeParse({
      label: 'Kilogram',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when label is missing', () => {
    const result = unitCreateSchema.safeParse({
      id: 'KG',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an id with whitespace', () => {
    const result = unitCreateSchema.safeParse({
      id: 'KG METRIC',
      label: 'Metric',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an id with lowercase letters', () => {
    const result = unitCreateSchema.safeParse({
      id: 'kg',
      label: 'Kilogram',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an id longer than 16 chars', () => {
    const result = unitCreateSchema.safeParse({
      id: 'A'.repeat(17),
      label: 'Too long',
    });
    expect(result.success).toBe(false);
  });

  it('accepts an omitted category', () => {
    const result = unitCreateSchema.safeParse({
      id: 'LOT',
      label: 'Lot',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a category outside the known set', () => {
    const result = unitCreateSchema.safeParse({
      id: 'NEW',
      label: 'New unit',
      category: 'unknown-thing',
    });
    expect(result.success).toBe(false);
  });
});

describe('unitUpdateSchema', () => {
  it('accepts a label-only patch with a reason', () => {
    const result = unitUpdateSchema.safeParse({
      id: 'KG',
      label: 'Kilogram (SI)',
      reason: 'Align with SI naming',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an update without a reason', () => {
    const result = unitUpdateSchema.safeParse({
      id: 'KG',
      label: 'Kilogram (SI)',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an update with an empty reason', () => {
    const result = unitUpdateSchema.safeParse({
      id: 'KG',
      label: 'Kilogram (SI)',
      reason: '',
    });
    expect(result.success).toBe(false);
  });
});
