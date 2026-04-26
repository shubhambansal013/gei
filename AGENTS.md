# Guidance for AI Assistants (AGENTS.md)

This file provides context and guidelines for AI agents working on the GEI project.

## 1. Project Overview
**GEI** — a multi-site construction-inventory web app.
- **Users:** Google OAuth only.
- **Roles:** SUPER_ADMIN, ADMIN, STORE_MANAGER, SITE_ENGINEER, VIEWER.
- **UX:** Excel-look VIEW, form-based ENTRY. Minimal clicks, mobile-friendly.
- **Stack:** Next.js 16 (App Router), Tailwind CSS v4, shadcn/ui (`base-nova`), Supabase (Postgres, RLS, Auth).

## 2. Core Principles & Invariants
- **RLS is the Trust Boundary:** Every mutation goes to Supabase with the user's JWT. RLS policies call `can_user()`. Frontend `can()` is for UI hints only.
- **Audit is Non-Bypassable:** `inventory_edit_log` is written by a Postgres trigger on UPDATEs to `purchases` and `issues`. Mutations must go through server actions that set `app.edit_reason`.
- **Soft Delete Only:** `is_deleted` flags are used. Hard DELETEs are blocked by policy.
- **Multi-site:** Every query and mutation must be scoped by `site_id`.
- **Modular Code:** Reuse components like `SearchableSelect`, `DataGrid`, `PermissionGate`, `ExportButton`, `PrintButton`.

## 3. Technical Guidelines
- **Tailwind CSS v4:** Theme tokens in `app/globals.css`. No `tailwind.config.ts`.
- **Database Schema:** `schema.sql` at root is the canonical source. Ordered migrations are in `supabase/migrations/`.
- **Testing:**
  - `lib/**/*.test.ts`: Logic unit tests (Vitest).
  - `components/**/*.test.tsx`: Component tests (RTL + Vitest).
  - `tests/rls/**/*.test.ts`: RLS policy tests (requires `supabase start`). Ensure full coverage of policies in `schema.sql`.
  - `supabase/tests/*.sql`: Database logic tests (pgTAP).
  - `tests/e2e/**/*.spec.ts`: Playwright e2e tests.
- **Linting & Types:** `pnpm lint` and `pnpm typecheck` must be clean.

## 4. Working Patterns
- **TDD:** Follow Test-Driven Development if specified in the plan.
- **Mandatory Testing:** Every PR must include relevant tests:
  - New DB triggers/functions? Add a pgTAP test in `supabase/tests/`.
  - New UI flow? Add/update a Playwright spec in `tests/e2e/`.
  - New business logic? Add a Vitest unit test in `**/__tests__/`.
  - New RLS policy? Add a Vitest RLS test in `tests/rls/`.
- **Conventional Commits:** Use `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
- **One Responsibility per File:** Keep files focused; split if they exceed ~300 lines.
- **No Direct Supabase Calls Skipping RLS:** Always respect the security model.

## 5. Key Documentation
- `README.md`: Project overview and setup.
- `docs/architecture.md`: High-level system design.
- `docs/permissions.md`: RBAC matrix and `can_user` details.
- `docs/runbooks/deploy.md`: Deployment guide for GitHub Actions and Cloudflare.
- `docs/archive/design-history/`: Historical design specs and plans.
