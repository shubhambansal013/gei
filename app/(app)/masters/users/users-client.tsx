'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { SearchableSelect } from '@/components/searchable-select';
import { Trash2, UserPlus } from 'lucide-react';
import { updateUserRole, grantSiteAccess, revokeSiteAccess, toggleUserActive } from './actions';

type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  role_id: string;
  is_active: boolean | null;
  created_at: string | null;
};
type Access = {
  id: string;
  user_id: string;
  site_id: string;
  role_id: string;
  granted_at: string | null;
  site: { id: string; code: string; name: string } | null;
};
type Site = { id: string; code: string; name: string };
type Role = { id: string; label: string; level: number };

type Props = {
  profiles: Profile[];
  access: Access[];
  sites: Site[];
  roles: Role[];
};

export function UsersClient({ profiles, access, sites, roles }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [grantingFor, setGrantingFor] = useState<string | null>(null);
  const [grantSiteId, setGrantSiteId] = useState<string | null>(null);
  const [grantRoleId, setGrantRoleId] = useState<string>('VIEWER');

  const roleBadgeTone = (roleId: string) => {
    if (roleId === 'SUPER_ADMIN') return 'bg-primary/10 text-primary border-primary/40';
    if (roleId === 'ADMIN') return 'bg-amber-50 text-amber-900 border-amber-300';
    if (roleId === 'STORE_MANAGER') return 'bg-sky-50 text-sky-900 border-sky-300';
    if (roleId === 'SITE_ENGINEER') return 'bg-emerald-50 text-emerald-900 border-emerald-300';
    return 'bg-muted text-muted-foreground';
  };

  const onRoleChange = (user_id: string, role_id: string) => {
    startTransition(async () => {
      const res = await updateUserRole({ user_id, role_id });
      if (res.ok) {
        toast.success('Role updated.');
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const onToggleActive = (user_id: string, is_active: boolean) => {
    startTransition(async () => {
      const res = await toggleUserActive({ user_id, is_active });
      if (res.ok) {
        toast.success(is_active ? 'Activated.' : 'Deactivated.');
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const onGrant = (user_id: string) => {
    if (!grantSiteId) return toast.error('Pick a site.');
    startTransition(async () => {
      const res = await grantSiteAccess({ user_id, site_id: grantSiteId, role_id: grantRoleId });
      if (res.ok) {
        toast.success('Access granted.');
        setGrantingFor(null);
        setGrantSiteId(null);
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const onRevoke = (access_id: string) => {
    startTransition(async () => {
      const res = await revokeSiteAccess({ access_id });
      if (res.ok) {
        toast.success('Access revoked.');
        router.refresh();
      } else toast.error(res.error);
    });
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Users</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Global role + per-site access. RLS still enforces the final say — this UI only hides
          controls that would fail anyway.
        </p>
      </header>

      {profiles.length === 0 ? (
        <EmptyState
          title="No users visible"
          description="Sign in a user via Google OAuth or the email fallback. They'll appear here as VIEWER on first sign-in."
        />
      ) : (
        <ul className="space-y-3">
          {profiles.map((p) => {
            const userAccess = access.filter((a) => a.user_id === p.id);
            const isInactive = p.is_active === false;
            return (
              <li
                key={p.id}
                className={`bg-card rounded-md border p-4 shadow-sm ${
                  isInactive ? 'opacity-60' : ''
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{p.full_name}</span>
                      <Badge variant="outline" className={`text-xs ${roleBadgeTone(p.role_id)}`}>
                        {p.role_id}
                      </Badge>
                      {isInactive && (
                        <Badge
                          variant="outline"
                          className="border-destructive/40 text-destructive bg-destructive/5 text-xs"
                        >
                          inactive
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-1 font-mono text-xs">{p.id}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select value={p.role_id} onValueChange={(v) => v && onRoleChange(p.id, v)}>
                      <SelectTrigger className="h-8 w-[160px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.id} className="text-xs">
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => onToggleActive(p.id, !(p.is_active ?? true))}
                    >
                      {isInactive ? 'Activate' : 'Deactivate'}
                    </Button>
                  </div>
                </div>

                <div className="mt-3 border-t pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                      Site access ({userAccess.length})
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setGrantingFor((cur) => (cur === p.id ? null : p.id))}
                    >
                      <UserPlus className="mr-1 h-3.5 w-3.5" />
                      {grantingFor === p.id ? 'Cancel' : 'Grant access'}
                    </Button>
                  </div>

                  {grantingFor === p.id && (
                    <div className="bg-muted/40 mb-3 flex flex-wrap items-end gap-2 rounded-sm p-3">
                      <div className="min-w-[220px] flex-1">
                        <label className="text-muted-foreground mb-1 block text-xs">Site</label>
                        <SearchableSelect
                          options={sites.map((s) => ({
                            value: s.id,
                            label: `${s.code} — ${s.name}`,
                          }))}
                          value={grantSiteId}
                          onChange={setGrantSiteId}
                          placeholder="Pick site"
                        />
                      </div>
                      <div>
                        <label className="text-muted-foreground mb-1 block text-xs">Role</label>
                        <Select value={grantRoleId} onValueChange={(v) => v && setGrantRoleId(v)}>
                          <SelectTrigger className="h-9 w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" disabled={pending} onClick={() => onGrant(p.id)}>
                        Grant
                      </Button>
                    </div>
                  )}

                  {userAccess.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      {p.role_id === 'SUPER_ADMIN'
                        ? 'SUPER_ADMIN sees every site regardless of access rows.'
                        : 'No per-site access yet. Grant access above.'}
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {userAccess.map((a) => (
                        <li
                          key={a.id}
                          className="bg-muted/40 flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs"
                        >
                          <span className="font-mono">{a.site?.code ?? '—'}</span>
                          <span className="text-muted-foreground">·</span>
                          <span>{a.role_id}</span>
                          <button
                            type="button"
                            onClick={() => onRevoke(a.id)}
                            className="text-muted-foreground hover:text-destructive ml-1"
                            aria-label="Revoke"
                            disabled={pending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
