import { describe, it, expect, vi } from 'vitest';
import { safeErrorMessage, ActionError } from '@/lib/actions/errors';

describe('safeErrorMessage', () => {
  // Silence console.error for tests
  vi.spyOn(console, 'error').mockImplementation(() => {});

  it('passes through messages from ActionError instances', () => {
    const msg = 'This is a safe error message';
    const err = new ActionError(msg);
    expect(safeErrorMessage(err)).toBe(msg);
  });

  it('maps known Postgres error codes to user-friendly messages', () => {
    const pgError = { code: '23505', message: 'duplicate key value violates unique constraint' };
    expect(safeErrorMessage(pgError)).toBe('A record with these details already exists.');
  });

  it('extracts Postgres error codes from stringified messages', () => {
    // Test regex SQLSTATE \s+ (\d{5})
    const rethrown = { message: 'Database error: SQLSTATE 23P01' };
    expect(safeErrorMessage(rethrown)).toBe('A record with overlapping dates already exists.');
  });

  it('returns a generic message for unknown errors', () => {
    const unknownErr = new Error('Something very bad happened internally');
    expect(safeErrorMessage(unknownErr)).toBe('Something went wrong. Please try again.');
  });

  it('returns a generic message for null or non-object inputs', () => {
    expect(safeErrorMessage(null)).toBe('Something went wrong. Please try again.');
    expect(safeErrorMessage('just a string')).toBe('Something went wrong. Please try again.');
  });
});
