# Testing Strategy

This project employs a four-tier testing strategy to ensure reliability across all layers of the stack.

## 1. Unit Tests (Vitest)
- **Scope:** Pure logic, utility functions, and React components.
- **Location:** `**/__tests__/*.test.ts(x)`
- **Execution:** `pnpm test`
- **Philosophy:** Focus on edge cases in validation logic and component rendering.

## 2. Database Logic Tests (pgTAP)
- **Scope:** SQL triggers, complex constraints, and PostgreSQL functions (e.g., `can_user`).
- **Location:** `supabase/tests/*.sql`
- **Execution:** `pnpm test:db` (requires Supabase CLI)
- **Philosophy:** Verify that security and audit invariants are enforced at the database level, regardless of the client.

## 3. RLS & Security Tests (Vitest)
- **Scope:** Row Level Security policies and multi-site access control.
- **Location:** `tests/rls/*.test.ts`
- **Execution:** `pnpm test:rls` (requires `supabase start`)
- **Philosophy:** Use real Supabase clients with different user roles to verify that RLS correctly filters data.

## 4. End-to-End (E2E) Tests (Playwright)
- **Scope:** Critical user flows ("Golden Paths") in a real browser environment.
- **Location:** `tests/e2e/*.spec.ts`
- **Execution:** `pnpm e2e`
- **Philosophy:** Validate the integration of frontend, backend, and database for high-value features like recording transactions.

---

## Continuous Integration (CI)
All tests are executed automatically on every Pull Request to `main`.
- `lint-typecheck-unit`: Checks code style, types, and runs Unit tests.
- `database`: Starts a local Supabase instance and runs pgTAP and RLS tests.
- `e2e`: Runs Playwright tests against a built version of the app.

## Quality Gates
We enforce coverage thresholds for different parts of the application:
- **Validators & Permissions:** 95% line coverage.
- **Server Actions:** 80% line coverage.
- **Components:** 60% line coverage.
