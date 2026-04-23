import 'server-only';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { safeErrorMessage } from '@/lib/actions/errors';

type SupabaseServerClient = Awaited<ReturnType<typeof supabaseServer>>;

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Wraps a server action body: validates the input with Zod and
 * normalizes thrown errors into a discriminated `ActionResult`.
 * Client components just check `res.ok` and display `res.data` or
 * `res.error` — no try/catch sprinkled across every form.
 *
 * Usage:
 *   export async function createItem(raw: unknown) {
 *     return runAction(itemCreateSchema, raw, async (input, sb) => {
 *       const { data, error } = await sb.from('items').insert(input).select().single();
 *       if (error) throw new Error(error.message);
 *       return data;
 *     });
 *   }
 */
export async function runAction<I, O>(
  schema: z.ZodType<I>,
  raw: unknown,
  body: (input: I, sb: SupabaseServerClient) => Promise<O>,
): Promise<ActionResult<O>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join('; '),
    };
  }
  try {
    const sb = await supabaseServer();
    const data = await body(parsed.data, sb);
    return { ok: true, data };
  } catch (e) {
    // Never leak raw pg/RLS messages to clients. `safeErrorMessage`
    // maps SQLSTATEs to user-safe copy and logs the full error to
    // `console.error` for server-side debugging.
    return {
      ok: false,
      error: safeErrorMessage(e),
    };
  }
}

/**
 * Sets `app.edit_reason` on the current DB transaction so the audit
 * trigger on `purchases` / `issues` captures the reason. Call
 * immediately before the UPDATE in the same server action.
 *
 * The Postgres function `set_config` is exposed via Supabase RPC;
 * `is_local = true` scopes the setting to the current transaction.
 */
export async function withAuditReason(sb: SupabaseServerClient, reason: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb as any).rpc('set_config', {
    setting_name: 'app.edit_reason',
    new_value: reason,
    is_local: true,
  });
}
