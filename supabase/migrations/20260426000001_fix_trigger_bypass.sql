-- Fix for Issue #22 privilege escalation trigger.
-- The previous implementation used SECURITY DEFINER which made current_user
-- always equal to the owner (postgres), thus always hitting the bypass.
-- We switch to session_user or just check auth headers properly.

CREATE OR REPLACE FUNCTION public.profiles_block_self_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. BYPASS FOR SYSTEM ADMINISTRATORS
  -- Allows the SQL Editor, migrations (postgres) and service_role to bypass.
  IF session_user = 'postgres' OR auth.role() = 'service_role' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. APPLICATION ADMIN CHECK
  -- If the authenticated user is already an admin, let them do anything.
  IF is_admin_anywhere(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- 3. SECURITY: BLOCK CROSS-USER UPDATES
  IF auth.uid() IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Non-admin users may only update their own profile.';
  END IF;

  -- 4. SECURITY: BLOCK SELF-PROMOTION
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
