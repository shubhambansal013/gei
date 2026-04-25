-- supabase/tests/helpers/auth.sql
-- Helpers for mocking Supabase Auth in pgTAP tests.

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO authenticated, anon;

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
  -- Mock the JWT claims that RLS policies (via auth.uid() and auth.role()) look for.
  -- We set both the full JSON and individual claims for compatibility with different auth.uid() definitions.
  EXECUTE format('SET LOCAL "request.jwt.claim.sub" = %L', p_user_id::text);
  EXECUTE format('SET LOCAL "request.jwt.claim.role" = %L', 'authenticated');
  EXECUTE format(
    'SET LOCAL "request.jwt.claims" = %L',
    json_build_object(
      'sub', p_user_id,
      'role', 'authenticated'
    )::text
  );
  SET LOCAL ROLE authenticated;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION tests.clear_authentication()
RETURNS VOID AS $$
BEGIN
  EXECUTE 'SET LOCAL "request.jwt.claim.sub" = ''''';
  EXECUTE 'SET LOCAL "request.jwt.claim.role" = ''''';
  EXECUTE 'SET LOCAL "request.jwt.claims" = ''''';
  RESET ROLE;
END;
$$ LANGUAGE plpgsql;
