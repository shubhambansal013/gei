# Permissions

## Model

Three layers, composed by the Postgres function `can_user(user_id,
site_id, module_id, action_id)`:

1. **Global role** on `profiles.role_id` — defaults to `VIEWER` on
   sign-up. `SUPER_ADMIN` short-circuits the check and returns `true`
   for everything.
2. **Per-site role** on `site_user_access.role_id` — what the user can
   do on a given site. No row → no access to that site.
3. **Per-permission override** on `site_user_permission_overrides` —
   narrows or widens individual module × action flags for one user on
   one site. Overrides win over the role defaults.

`can_user()` is `SECURITY DEFINER` and is called from every RLS policy
that protects inventory/location data.

## Role × module × action matrix (defaults)

|               | INVENTORY  | DPR     | LABOUR | LOCATION | REPORTS |
| ------------- | ---------- | ------- | ------ | -------- | ------- |
| SUPER_ADMIN   | ALL        | ALL     | ALL    | ALL      | ALL     |
| ADMIN         | ALL        | ALL     | ALL    | ALL      | ALL     |
| STORE_MANAGER | V, C, E, X | –       | –      | V        | V       |
| SITE_ENGINEER | V          | V, C, E | V      | V        | V       |
| VIEWER        | V          | V       | V      | V        | V       |

Where `V`=VIEW, `C`=CREATE, `E`=EDIT, `X`=EXPORT. `DELETE` is never
granted — soft-delete via EDIT is the only way to remove a transaction.

## Masters (items, parties, sites) — separate policy set

Masters are tenant-wide reference data. They don't go through
`can_user()` — instead they use `is_admin_anywhere()`:

- **Items, parties:** any authenticated user can SELECT; only
  SUPER_ADMIN globally or ADMIN on at least one site can INSERT /
  UPDATE / DELETE.
- **Sites:** SELECT is restricted to SUPER_ADMIN or users with a
  `site_user_access` row for that site; WRITE is admin-only.
- **Profiles, site_user_access:** SELECT is self-or-admin;
  `site_user_access` WRITE is admin-only.

## Frontend `can()`

The TypeScript helper in `lib/permissions/can.ts` calls the same
`can_user` RPC and caches the result per (siteId × module × action)
for the lifetime of the returned function. Use via `<PermissionGate>`:

```tsx
<PermissionGate siteId={siteId} module="INVENTORY" action="EDIT">
  <Button>Edit row</Button>
</PermissionGate>
```

The gate renders nothing while the permission check is in-flight to
avoid a flash of unauthorized UI. It's purely presentational — RLS at
the DB layer is the real enforcement.

## Extending

Adding a new module is additive, no `can_user()` change needed:

1. `INSERT INTO modules (id, label) VALUES (...);`
2. `INSERT INTO role_permissions (role_id, module_id, action_id) VALUES ...;`
3. Create the new table with RLS enabled, policies calling
   `can_user(auth.uid(), site_id, '<NEW_MODULE>', '<ACTION>')`.
4. Wire UI via `<PermissionGate module="<NEW_MODULE>" ...>`.

## Per-user overrides — worked example

Grant a STORE_MANAGER on Site A an extra `DPR.VIEW` capability just
for this one user, without promoting them to SITE_ENGINEER:

```sql
-- Find the access row
SELECT id FROM site_user_access
WHERE user_id = '<user-uuid>' AND site_id = '<site-uuid>';

-- Grant the override
INSERT INTO site_user_permission_overrides
  (access_id, module_id, action_id, granted)
VALUES
  ('<access-id>', 'DPR', 'VIEW', true);
```

To revoke a default permission (e.g., strip a STORE_MANAGER's
`INVENTORY.EXPORT` on a specific site) use `granted = false` — the
override returns false immediately in `can_user()` without falling
back to the role default.

## Testing

Every RLS policy has at least one test in `tests/rls/` that asserts
the policy works for one allowed role and one denied role. The test
harness in `tests/rls/helpers.ts` handles creating users, setting
global roles, and cleanup. Run with:

```bash
supabase start   # if not already running
pnpm test:rls
```

## First SUPER_ADMIN bootstrap

New Google sign-ups land as `VIEWER`. Seed the first SUPER_ADMIN with
a one-time SQL command in Supabase Studio:

```sql
UPDATE profiles SET role_id = 'SUPER_ADMIN' WHERE id = '<user-uid>';
```

After that, all further role and site-access changes happen through
the admin UI (Phase 3) or direct SQL.
