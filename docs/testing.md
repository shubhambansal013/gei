# Testing Documentation

This document explains the testing strategy and how to write and run tests for the GEI project.

## 1. Test Categories

- **Unit/Logic Tests (`lib/**/*.test.ts`)**: Pure logic, utilities, and helper functions tested with Vitest.
- **Component Tests (`components/**/*.test.tsx`)**: UI component rendering and interaction tested with Vitest + React Testing Library.
- **Database / RLS Tests (`supabase/tests/*.test.sql`)**: Row-Level Security, triggers, and database-level logic tested with pgTAP via the Supabase CLI.
- **E2E Smoke Tests (`tests/e2e/*.spec.ts`)**: High-level UI flow verification (e.g., login, navigation) tested with Playwright.

## 2. Database Testing with pgTAP

Database-level tests (including RLS) are the primary trust boundary of the application. They are written in SQL using pgTAP.

### Running Database Tests

Ensure your local Supabase instance is running:

```bash
pnpm db:start
```

Then run the tests:

```bash
pnpm test:db
```

### Writing a New Database Test

1. Create a new `.test.sql` file in `supabase/tests/`.
2. Wrap your test in a `BEGIN;` ... `ROLLBACK;` block to ensure tests are isolated and don't persist data.
3. Use `\ir helpers/auth.sql` to include authentication helpers.
4. Use `tests.create_test_user(...)` to setup test subjects.
5. Use `tests.authenticate_as(...)` to simulate different user roles.
6. Use pgTAP functions like `plan()`, `lives_ok()`, `throws_ok()`, `results_eq()`, and `finish()`.

Example:

```sql
BEGIN;
SELECT plan(1);
\ir helpers/auth.sql

SELECT tests.create_test_user('00000000-0000-0000-0000-000000000001', 'test@example.com', 'VIEWER');
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000001');

SELECT throws_ok(
  'INSERT INTO items (code, name) VALUES (''FOO'', ''Bar'')',
  42501, -- Insufficient Privilege
  'VIEWER cannot insert items'
);

SELECT * FROM finish();
ROLLBACK;
```

## 3. Other Tests

- **Vitest**: `pnpm test`
- **Playwright**: `pnpm e2e`
