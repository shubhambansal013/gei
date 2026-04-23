'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { saveRolePermissions } from './actions';

type Role = { id: string; label: string; level: number };
type Module = { id: string; label: string };
type Action = { id: string; label: string };
type RP = { role_id: string; module_id: string; action_id: string };

type Props = {
  roles: Role[];
  modules: Module[];
  actions: Action[];
  rolePermissions: RP[];
};

/**
 * Matrix editor for `role_permissions`.
 *
 * Rows  = (role × module) — one per meaningful cell group.
 * Cols  = actions (VIEW / CREATE / EDIT / DELETE / EXPORT).
 * Cells = checkboxes toggling a single `role_permissions` row.
 *
 * SUPER_ADMIN rows are pinned read-only — losing permissions on
 * SUPER_ADMIN would lock the tenant out. Everything else is editable.
 *
 * State is held locally as a `Set` of "role|module|action" keys so
 * toggling is O(1) and the save-diff is trivial.
 */
export function RolePermissionsClient({ roles, modules, actions, rolePermissions }: Props) {
  const router = useRouter();
  const initialKeys = useMemo(
    () => new Set(rolePermissions.map((r) => `${r.role_id}|${r.module_id}|${r.action_id}`)),
    [rolePermissions],
  );

  const [keys, setKeys] = useState<Set<string>>(() => new Set(initialKeys));
  const [busy, setBusy] = useState(false);

  const isDirty = useMemo(() => {
    if (keys.size !== initialKeys.size) return true;
    for (const k of keys) if (!initialKeys.has(k)) return true;
    return false;
  }, [keys, initialKeys]);

  const keyOf = (roleId: string, moduleId: string, actionId: string) =>
    `${roleId}|${moduleId}|${actionId}`;

  const toggle = (roleId: string, moduleId: string, actionId: string) => {
    const k = keyOf(roleId, moduleId, actionId);
    setKeys((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const reset = () => setKeys(new Set(initialKeys));

  const save = async () => {
    setBusy(true);
    try {
      const desired = Array.from(keys).map((k) => {
        const [role_id, module_id, action_id] = k.split('|');
        return { role_id: role_id!, module_id: module_id!, action_id: action_id! };
      });
      const res = await saveRolePermissions({ desired });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Saved — ${res.data.inserted} added, ${res.data.deleted} removed.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Role permissions</h1>
        <p className="text-muted-foreground text-sm">
          Default permissions applied to every site. Per-user exceptions live in site-user
          overrides. Only SUPER_ADMIN can save changes here.
        </p>
      </header>

      <div className="print:hide flex items-center gap-2">
        <Button onClick={save} disabled={!isDirty || busy} size="sm">
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
        <Button onClick={reset} disabled={!isDirty || busy} variant="outline" size="sm">
          Reset
        </Button>
        {isDirty && <span className="text-muted-foreground text-xs">Unsaved changes.</span>}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="bg-muted/50 sticky left-0 z-10 px-3 py-2 text-left font-semibold">
                Role
              </th>
              <th className="px-3 py-2 text-left font-semibold">Module</th>
              {actions.map((a) => (
                <th key={a.id} className="px-3 py-2 text-center font-semibold">
                  {a.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.flatMap((role) =>
              modules.map((mod, mIdx) => {
                const readOnly = role.id === 'SUPER_ADMIN';
                return (
                  <tr key={`${role.id}-${mod.id}`} className="hover:bg-muted/30 border-t">
                    {mIdx === 0 ? (
                      <td
                        rowSpan={modules.length}
                        className="bg-background sticky left-0 z-10 border-r px-3 py-2 align-top font-semibold"
                      >
                        {role.label}
                        {readOnly && (
                          <div className="text-muted-foreground mt-1 text-xs font-normal">
                            Pinned — full access
                          </div>
                        )}
                      </td>
                    ) : null}
                    <td className="px-3 py-2">{mod.label}</td>
                    {actions.map((a) => {
                      const k = keyOf(role.id, mod.id, a.id);
                      const checked = keys.has(k);
                      return (
                        <td key={a.id} className="px-3 py-2 text-center">
                          <Checkbox
                            checked={checked}
                            disabled={readOnly || busy}
                            onCheckedChange={() => toggle(role.id, mod.id, a.id)}
                            aria-label={`${role.label} · ${mod.label} · ${a.label}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
