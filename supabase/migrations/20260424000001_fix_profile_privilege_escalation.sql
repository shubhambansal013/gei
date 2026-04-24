-- Issue #22 — Privilege escalation via profiles self-update.
--
-- The `profiles_update_self_or_admin` policy from
-- 20260420000004_masters_rls.sql allows a user to UPDATE their own
-- profile row but has no WITH CHECK clause and no column-level
-- restriction. A SITE_ENGINEER / VIEWER / any authenticated user
-- can therefore:
--   - set `role_id = 'SUPER_ADMIN'` on themselves
--   - set `is_active = false` on themselves or others via the admin
--     policy (already admin-gated, OK) or on themselves via self-policy
--   - stamp fake `approved_at` / `approved_by`
--
-- Fix shape: keep the existing self-UPDATE policy (users legitimately
-- edit their own full_name via /masters/users) but block the four
-- privileged columns with a BEFORE UPDATE trigger. A trigger is safer
-- than a column-level policy because it fires regardless of which
-- policy granted the UPDATE — defence-in-depth against future policy
-- changes that widen self-writes.
--
-- The trigger is SECURITY DEFINER and checks `auth.uid()` and
-- `is_admin_anywhere(auth.uid())` inside plpgsql; if the caller is
-- not an admin AND is updating their own row, any change to
-- role_id / is_active / approved_at / approved_by raises 42501 with
-- a message the pg-error-mapper (lib/actions/errors.ts) will route to
-- the generic "You do not have permission" toast.

CREATE OR REPLACE FUNCTION public.profiles_block_self_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin writes and service role are unrestricted (handled by profiles_update policies).
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') OR is_admin_anywhere(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Non-admin touching someone else's row is already blocked by RLS,
  -- but we defend against that case here too in case the policy drifts.
  IF auth.uid() IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Non-admin users may only update their own profile.';
  END IF;

  -- Self-update: block the four privileged columns.
  IF NEW.role_id     IS DISTINCT FROM OLD.role_id
  OR NEW.is_active   IS DISTINCT FROM OLD.is_active
  OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
  OR NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Privileged profile columns can only be changed by an administrator.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_self_privilege_escalation_trg ON profiles;
CREATE TRIGGER profiles_block_self_privilege_escalation_trg
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_block_self_privilege_escalation();
