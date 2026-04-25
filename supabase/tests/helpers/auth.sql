-- supabase/tests/helpers/auth.sql
-- Helpers for mocking Supabase Auth in pgTAP tests.

CREATE SCHEMA IF NOT EXISTS tests;

CREATE OR REPLACE FUNCTION tests.create_test_user(
  p_id UUID,
  p_email TEXT,
  p_role TEXT DEFAULT 'VIEWER',
  p_is_active BOOLEAN DEFAULT true
) RETURNS VOID AS $$
BEGIN
  -- Insert into auth.users (mocking the Supabase auth schema)
  -- Note: In local Supabase, the auth schema exists.
  INSERT INTO auth.users (id, email, created_at, updated_at)
  VALUES (p_id, p_email, now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- Profile should be created by trigger, but we ensure role/active status
  UPDATE public.profiles
     SET role_id = p_role,
         is_active = p_is_active
   WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION tests.authenticate_as(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Mock the JWT claims that RLS policies (via auth.uid()) look for.
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L', json_build_object('sub', p_user_id)::text);
  -- Also set role if needed, though most policies use auth.uid()
  SET LOCAL ROLE authenticated;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION tests.clear_authentication()
RETURNS VOID AS $$
BEGIN
  RESET "request.jwt.claims";
  RESET ROLE;
END;
$$ LANGUAGE plpgsql;
