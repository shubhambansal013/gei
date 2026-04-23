import { z } from 'zod';

/**
 * Per-user permission override on a given site_user_access row.
 * `granted=true` widens, `granted=false` narrows, neither falls back
 * to the role default in can_user().
 */
export const permissionOverrideSchema = z.object({
  access_id: z.string().uuid(),
  module_id: z.enum(['INVENTORY', 'WORKERS', 'LOCATION', 'REPORTS']),
  action_id: z.enum(['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT']),
  granted: z.boolean(),
});

export const permissionOverrideDeleteSchema = z.object({
  override_id: z.string().uuid(),
});

export type PermissionOverride = z.infer<typeof permissionOverrideSchema>;
