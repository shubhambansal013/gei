/**
 * Unit tests for the safe-error mapper. Raw Postgres errors carry RLS
 * text, table names, and SQL details we must never surface to users
 * via toast. The mapper converts SQLSTATE codes (or .code on Supabase
 * PostgrestError objects) into short, human-safe copy.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeErrorMessage, ActionError } from '../errors';

describe('safeErrorMessage', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    errorSpy.mockClear();
  });

  afterEach(() => {
    errorSpy.mockClear();
  });

  it('maps Postgres 42501 (RLS / permission denied) to a friendly permission message', () => {
    const raw = {
      code: '42501',
      message: 'new row violates row-level security policy for table "items"',
    };
    expect(safeErrorMessage(raw)).toBe('You do not have permission to perform this action.');
  });

  it('maps Postgres 23505 (unique_violation) to duplicate-record copy', () => {
    const raw = { code: '23505', message: 'duplicate key value violates unique constraint' };
    expect(safeErrorMessage(raw)).toBe('A record with these details already exists.');
  });

  it('maps Postgres 23503 (foreign_key_violation) to missing-reference copy', () => {
    const raw = { code: '23503', message: 'update or delete on table "sites" violates FK' };
    expect(safeErrorMessage(raw)).toBe(
      'Cannot complete: the referenced record is missing or still in use.',
    );
  });

  it('maps Postgres 23514 (check_violation) to invalid-fields copy', () => {
    const raw = { code: '23514', message: 'new row for relation "purchases" violates check' };
    expect(safeErrorMessage(raw)).toBe('One or more fields are invalid.');
  });

  it('maps Postgres 23502 (not_null_violation) to invalid-fields copy', () => {
    const raw = { code: '23502', message: 'null value in column "site_id" violates not-null' };
    expect(safeErrorMessage(raw)).toBe('One or more fields are invalid.');
  });

  it('maps Postgres 23P01 (exclusion_violation) to overlapping dates copy', () => {
    const raw = { code: '23P01', message: 'conflicting key value violates exclusion constraint' };
    expect(safeErrorMessage(raw)).toBe('A record with overlapping dates already exists.');
  });

  it('returns a generic message for unknown codes', () => {
    expect(safeErrorMessage({ code: '99999', message: 'weird internal thing' })).toBe(
      'Something went wrong. Please try again.',
    );
  });

  it('returns a generic message for plain Error without a code', () => {
    expect(safeErrorMessage(new Error('bad happened'))).toBe(
      'Something went wrong. Please try again.',
    );
  });

  it('returns a generic message for non-Error inputs', () => {
    expect(safeErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
    expect(safeErrorMessage(null)).toBe('Something went wrong. Please try again.');
    expect(safeErrorMessage('boom')).toBe('Something went wrong. Please try again.');
  });

  it('returns the message directly for ActionError', () => {
    const err = new ActionError('User-safe domain message');
    expect(safeErrorMessage(err)).toBe('User-safe domain message');
  });

  it('extracts the code when it appears embedded in an Error.message (SQLSTATE ...)', () => {
    // Some pg clients stringify errors as "... SQLSTATE 42501"
    const err = new Error('something something SQLSTATE 42501');
    expect(safeErrorMessage(err)).toBe('You do not have permission to perform this action.');
  });

  it('extracts alphanumeric SQLSTATE codes like 23P01 from Error.message', () => {
    const err = new Error('something something SQLSTATE 23P01');
    expect(safeErrorMessage(err)).toBe('A record with overlapping dates already exists.');
  });

  it('logs the full error to console.error for server-side debugging', () => {
    const raw = { code: '42501', message: 'internal rls detail' };
    safeErrorMessage(raw);
    expect(errorSpy).toHaveBeenCalled();
  });

  // Message-pattern fallback: many server actions throw `new Error(error.message)`,
  // which loses the `.code`. Recovering from the text lets the mapper still produce
  // human copy instead of "Something went wrong".
  it('recovers permission copy from RLS text when code was dropped', () => {
    const err = new Error('new row violates row-level security policy for table "items"');
    expect(safeErrorMessage(err)).toBe('You do not have permission to perform this action.');
  });

  it('recovers duplicate copy from unique-violation text when code was dropped', () => {
    const err = new Error('duplicate key value violates unique constraint "items_code_key"');
    expect(safeErrorMessage(err)).toBe('A record with these details already exists.');
  });

  it('recovers FK copy from foreign-key text when code was dropped', () => {
    const err = new Error(
      'update or delete on table "parties" violates foreign key constraint on table "purchases"',
    );
    expect(safeErrorMessage(err)).toBe(
      'Cannot complete: the referenced record is missing or still in use.',
    );
  });

  it('recovers invalid-fields copy from check-violation text when code was dropped', () => {
    const err = new Error('new row for relation "issues" violates check constraint "chk_qty"');
    expect(safeErrorMessage(err)).toBe('One or more fields are invalid.');
  });

  it('recovers invalid-fields copy from not-null text when code was dropped', () => {
    const err = new Error('null value in column "site_id" of relation "purchases" violates ...');
    expect(safeErrorMessage(err)).toBe('One or more fields are invalid.');
  });

  it('recovers overlapping dates copy from exclusion text when code was dropped', () => {
    const err = new Error('conflicting key value violates exclusion constraint "overlap"');
    expect(safeErrorMessage(err)).toBe('A record with overlapping dates already exists.');
  });
});
