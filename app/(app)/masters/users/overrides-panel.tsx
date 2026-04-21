'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { upsertPermissionOverride, deletePermissionOverride } from './actions';

const MODULES = ['INVENTORY', 'DPR', 'LABOUR', 'LOCATION', 'REPORTS'] as const;
const ACTIONS = ['VIEW', 'CREATE', 'EDIT', 'EXPORT'] as const;
// DELETE intentionally omitted from the override grid — we never grant hard-delete;
// soft-delete is handled via EDIT.

type Override = {
  id: string;
  access_id: string;
  module_id: string;
  action_id: string;
  granted: boolean;
};

type Props = {
  accessId: string;
  overrides: Override[];
};

/**
 * Matrix editor for `site_user_permission_overrides` rows attached to
 * one `site_user_access` record. Click a cell to cycle:
 *   (no override / role default)  →  grant (true)  →  revoke (false)  →  (no override)
 */
export function OverridesPanel({ accessId, overrides }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const byKey = new Map<string, Override>();
  for (const o of overrides.filter((o) => o.access_id === accessId)) {
    byKey.set(`${o.module_id}:${o.action_id}`, o);
  }

  const cycle = (module_id: string, action_id: string) => {
    const existing = byKey.get(`${module_id}:${action_id}`);
    startTransition(async () => {
      // State machine: none → grant(true) → deny(false) → none
      if (!existing) {
        const res = await upsertPermissionOverride({
          access_id: accessId,
          module_id,
          action_id,
          granted: true,
        });
        if (!res.ok) toast.error(res.error);
      } else if (existing.granted) {
        const res = await upsertPermissionOverride({
          access_id: accessId,
          module_id,
          action_id,
          granted: false,
        });
        if (!res.ok) toast.error(res.error);
      } else {
        const res = await deletePermissionOverride({ override_id: existing.id });
        if (!res.ok) toast.error(res.error);
      }
      router.refresh();
    });
  };

  const cellClass = (state: 'grant' | 'deny' | 'default') => {
    if (state === 'grant') return 'bg-primary/15 text-primary border-primary/40';
    if (state === 'deny') return 'bg-destructive/10 text-destructive border-destructive/40';
    return 'bg-muted/20 text-muted-foreground border-transparent';
  };

  return (
    <div className="bg-muted/20 mt-3 rounded-sm border p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          Per-permission overrides
        </div>
        <div className="text-muted-foreground text-[10px]">click: none → grant → deny → none</div>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="text-left font-medium"></th>
            {ACTIONS.map((a) => (
              <th key={a} className="pb-1.5 text-center font-medium">
                {a}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULES.map((m) => (
            <tr key={m}>
              <td className="text-muted-foreground py-0.5 pr-2 font-mono text-[11px]">{m}</td>
              {ACTIONS.map((a) => {
                const ex = byKey.get(`${m}:${a}`);
                const state: 'grant' | 'deny' | 'default' = ex
                  ? ex.granted
                    ? 'grant'
                    : 'deny'
                  : 'default';
                const label = state === 'grant' ? '+' : state === 'deny' ? '×' : '·';
                return (
                  <td key={a} className="py-0.5 text-center">
                    <button
                      type="button"
                      onClick={() => cycle(m, a)}
                      disabled={pending}
                      aria-label={`${state} ${m} ${a}`}
                      title={
                        state === 'grant'
                          ? `Override: grant ${m}.${a}`
                          : state === 'deny'
                            ? `Override: deny ${m}.${a}`
                            : `Default for role (no override)`
                      }
                      className={`w-8 rounded-sm border px-1 py-0.5 font-mono text-sm ${cellClass(state)}`}
                    >
                      {label}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OverrideChip({
  override,
  onRevoke,
}: {
  override: Override;
  onRevoke: (id: string) => void;
}) {
  const tone = override.granted
    ? 'border-primary/40 bg-primary/10 text-primary'
    : 'border-destructive/40 bg-destructive/10 text-destructive';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs ${tone}`}
    >
      {override.granted ? '+' : '×'} {override.module_id}.{override.action_id}
      <button
        type="button"
        onClick={() => onRevoke(override.id)}
        className="hover:opacity-70"
        aria-label="Remove override"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </span>
  );
}
