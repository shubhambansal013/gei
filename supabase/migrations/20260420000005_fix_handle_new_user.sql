-- 20260420000005_fix_handle_new_user.sql
-- The base schema's handle_new_user() trigger function referenced
-- `profiles` unqualified. When fired from auth.users inserts, the
-- search_path does not include `public` and the function fails with:
--   relation "profiles" does not exist (SQLSTATE 42P01)
-- which surfaces to clients as a 500 "Database error creating new user".
--
-- Fix: qualify the insert as `public.profiles`. Same for any subsequent
-- statements that might depend on search_path.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'VIEWER'
  );
  RETURN NEW;
END;
