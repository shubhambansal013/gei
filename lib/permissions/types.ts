/**
 * Canonical type set for the permissions layer. Module / action /
 * role ids mirror the reference rows in `schema.sql` so a TS string
 * union drift would fail typecheck against the generated DB types.
 */

export type ModuleId = 'INVENTORY' | 'DPR' | 'LABOUR' | 'WORKERS' | 'LOCATION' | 'REPORTS';

export type ActionId = 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE' | 'EXPORT';

export type RoleId = 'SUPER_ADMIN' | 'ADMIN' | 'STORE_MANAGER' | 'SITE_ENGINEER' | 'VIEWER';

export interface PermissionKey {
  siteId: string;
  module: ModuleId;
  action: ActionId;
}
