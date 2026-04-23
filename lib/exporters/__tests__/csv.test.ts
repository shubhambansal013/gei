import { describe, it, expect } from 'vitest';
import { toCSV } from '../csv';

describe('toCSV', () => {
  it('renders header and rows', () => {
    const out = toCSV({
      columns: [
        { key: 'name', header: 'Name' },
        { key: 'qty', header: 'Qty' },
      ],
      rows: [
        { name: 'Cement', qty: 100 },
        { name: 'Rebar', qty: 50 },
      ],
    });
    expect(out).toBe('\uFEFFName,Qty\nCement,100\nRebar,50');
  });

  it('escapes quotes, commas, and newlines', () => {
    const out = toCSV({
      columns: [{ key: 'x', header: 'X' }],
      rows: [{ x: 'hello, "friend"\nworld' }],
    });
    expect(out).toBe('\uFEFFX\n"hello, ""friend""\nworld"');
  });

  it('handles null/undefined as empty', () => {
    const out = toCSV({
      columns: [{ key: 'x', header: 'X' }],
      rows: [{ x: null }, { x: undefined }],
    });
    expect(out).toBe('\uFEFFX\n\n');
  });
});
