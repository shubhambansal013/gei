/**
 * Safe, user-facing error messages for Supabase/Postgres mutation
 * failures. Raw pg errors leak table names, RLS policy names, and
 * check-constraint text that users should never see in a toast.
 *
 * Called from a server-action catch block (`runAction` wires this in).
 * The function also logs the full error to `console.error` so server
 * logs keep the debugging trail, while client toasts only see the
 * scrubbed string.
 *
 * Mapping is deliberately narrow. Unknown codes fall through to a
 * generic message so we don't accidentally reveal novel Postgres error
 * text when the DB changes under us.
 *
 * Kept as a pure helper (no `'server-only'` pragma) so the mapping
 * table can be unit-tested from Vitest's jsdom env. Real callers
 * reach it via `shared.ts`, which is itself `'server-only'`.
 */

const MESSAGES: Record<string, string> = {
  // insufficient_privilege — raised by RLS WITH CHECK / USING denials.
  '42501': 'You do not have permission to perform this action.',
  // unique_violation
  '23505': 'A record with these details already exists.',
  // foreign_key_violation — either insert points at a missing row, or
  // delete/update is blocked by a child row.
  '23503': 'Cannot complete: the referenced record is missing or still in use.',
  // check_violation
  '23514': 'One or more fields are invalid.',
  // not_null_violation
  '23502': 'One or more fields are invalid.',
  // exclusion_violation — e.g. overlapping dates in worker history.
  '23P01': 'This change conflicts with an existing record (e.g. date overlap).',
};

const GENERIC = 'Something went wrong. Please try again.';

/**
 * Patterns to recover the SQLSTATE when a Supabase `PostgrestError`
 * has been re-thrown as `new Error(error.message)` — which drops the
 * `.code`. Order is irrelevant since the codes partition the space.
 */
const MESSAGE_PATTERNS: Array<[RegExp, string]> = [
  [/row-level security policy/i, '42501'],
  [/permission denied for/i, '42501'],
  [/duplicate key value/i, '23505'],
  [/violates unique constraint/i, '23505'],
  [/violates foreign key constraint/i, '23503'],
  [/foreign key constraint/i, '23503'],
  [/violates check constraint/i, '23514'],
  [/null value in column/i, '23502'],
  [/violates not-null constraint/i, '23502'],
  [/conflicting key value violates exclusion constraint/i, '23P01'],
  [/violates exclusion constraint/i, '23P01'],
];

function extractCode(e: unknown): string | null {
  if (!e || typeof e !== 'object') return null;
  const obj = e as { code?: unknown; message?: unknown };
  if (typeof obj.code === 'string' && obj.code.length > 0) return obj.code;
  // Some pg wrappers stringify SQLSTATE into .message.
  if (typeof obj.message === 'string') {
    const msg = obj.message;
    const match = msg.match(/SQLSTATE\s+(\d{5})/i);
    if (match && match[1]) return match[1];
    for (const [re, code] of MESSAGE_PATTERNS) {
      if (re.test(msg)) return code;
    }
  }
  return null;
}

export function safeErrorMessage(e: unknown): string {
  // Server-only log — keeps the debugging trail outside of client toasts.
  console.error('[safeErrorMessage]', e);
  const code = extractCode(e);
  if (code && code in MESSAGES) {
    const mapped = MESSAGES[code];
    if (mapped) return mapped;
  }
  return GENERIC;
}
