# GEI Inventory — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the scaffolding, auth, RBAC, reusable UI building blocks, schema additions, audit triggers, exports, print, and CI that every later plan depends on.

**Architecture:** Next.js 15 App Router frontend talks directly to Supabase. Every mutation is guarded by RLS; the client's `can()` helper only hides UI. All reusable components are built once here and consumed by the Masters and Transactions plans that follow.

**Tech Stack:** Next.js 15 (App Router) · TypeScript (strict) · Tailwind · shadcn/ui · TanStack Table v8 · TanStack Query v5 · React Hook Form + Zod · Supabase (Postgres, Auth, RLS) · Vitest · RTL · Playwright · pnpm · GitHub Actions.

**Sibling plans (written later, depend on this one):**
- `2026-04-20-gei-inventory-masters.md`
- `2026-04-20-gei-inventory-transactions.md`

---

## File structure produced by this plan

```
.
├── .github/workflows/ci.yml
├── .husky/pre-commit
├── .env.local.example
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── next.config.mjs
├── components.json                  # shadcn/ui config
├── vitest.config.ts
├── vitest.setup.ts
├── playwright.config.ts
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 20260420000001_base_schema.sql
│   │   ├── 20260420000002_schema_additions.sql
│   │   ├── 20260420000003_audit_log.sql
│   │   └── 20260420000004_masters_rls.sql
│   └── seed/
│       └── 0001_bootstrap.sql
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── auth/callback/route.ts
│   │   └── pending/page.tsx
│   └── (app)/
│       ├── layout.tsx
│       └── dashboard/page.tsx       # placeholder; real dashboard in Phase 2
├── middleware.ts
├── lib/
│   ├── supabase/
│   │   ├── browser.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── permissions/
│   │   ├── can.ts
│   │   ├── types.ts
│   │   └── __tests__/can.test.ts
│   ├── exporters/
│   │   ├── csv.ts
│   │   ├── xlsx.ts
│   │   └── __tests__/{csv,xlsx}.test.ts
│   └── stores/site.ts
├── components/
│   ├── app-shell.tsx
│   ├── site-switcher.tsx
│   ├── permission-gate.tsx
│   ├── searchable-select.tsx
│   ├── data-grid.tsx
│   ├── export-button.tsx
│   ├── print-button.tsx
│   ├── confirm-dialog.tsx
│   ├── empty-state.tsx
│   └── __tests__/*.test.tsx
├── tests/
│   ├── rls/{purchases,issues,edit_log,masters}.test.ts
│   └── e2e/smoke.spec.ts
└── docs/
    ├── architecture.md
    └── permissions.md
```

---

## Task 1: Scaffold Next.js 15 + TypeScript strict

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `app/layout.tsx`, `app/globals.css`, `.gitignore`

- [ ] **Step 1: Scaffold via `create-next-app`**

Run:
```bash
pnpm create next-app@latest . \
  --typescript --tailwind --app --eslint --src-dir=false \
  --import-alias "@/*" --use-pnpm --no-turbopack --yes
```
Expected: `package.json`, `app/`, `tailwind.config.ts`, `next.config.mjs` created. No errors.

- [ ] **Step 2: Enable TypeScript strict mode**

Edit `tsconfig.json` — under `compilerOptions`, ensure:
```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true,
  "exactOptionalPropertyTypes": true
}
```

- [ ] **Step 3: Lock Node engine in `package.json`**

Add top-level:
```json
"engines": { "node": ">=20.11.0", "pnpm": ">=9" }
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: build succeeds; no TS errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 + TS strict

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: shadcn/ui + Tailwind base

**Files:**
- Create: `components.json`, `components/ui/*` (generated), `app/globals.css` (updated)

- [ ] **Step 1: Initialize shadcn/ui**

Run:
```bash
pnpm dlx shadcn@latest init --yes --defaults
```
Expected: `components.json` created, Tailwind config updated with CSS variables, `app/globals.css` updated with shadcn theme tokens.

- [ ] **Step 2: Add base components used across the app**

Run:
```bash
pnpm dlx shadcn@latest add button input label select dialog \
  dropdown-menu popover command toast sonner sheet tabs \
  separator scroll-area checkbox form badge
```
Expected: files appear under `components/ui/`.

- [ ] **Step 3: Add Excel-feel utility classes**

Append to `app/globals.css`:
```css
/* Excel grid feel */
.excel-grid { @apply font-mono text-sm; }
.excel-grid th,
.excel-grid td {
  @apply border border-gray-300 px-2 py-1;
}
.excel-grid thead th {
  @apply bg-gray-100 sticky top-0 z-10 font-semibold text-left;
}
.excel-grid tbody tr:nth-child(even) {
  @apply bg-gray-50;
}
.excel-grid tbody tr:hover { @apply bg-blue-50; }
.excel-grid .row-num {
  @apply bg-gray-100 text-gray-500 text-right sticky left-0 z-10;
}

@media print {
  .print\:hide { display: none !important; }
  .excel-grid { font-size: 10px; }
  .excel-grid thead { display: table-header-group; }
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: add shadcn/ui base + Excel grid styles"
```

---

## Task 3: Lint, format, Husky pre-commit

**Files:**
- Create: `.prettierrc`, `.prettierignore`, `.husky/pre-commit`, `lint-staged.config.mjs`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install dev deps**

```bash
pnpm add -D prettier prettier-plugin-tailwindcss husky lint-staged \
  eslint-config-prettier @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser
```

- [ ] **Step 2: Write `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [ ] **Step 3: Add `lint-staged.config.mjs`**

```js
export default {
  '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{css,md,json}': ['prettier --write'],
};
```

- [ ] **Step 4: Enable Husky**

```bash
pnpm exec husky init
```
Then overwrite `.husky/pre-commit`:
```sh
#!/usr/bin/env sh
pnpm lint-staged
pnpm typecheck
```

- [ ] **Step 5: Add scripts to `package.json`**

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "typecheck": "tsc --noEmit",
  "lint": "next lint",
  "format": "prettier --write .",
  "test": "vitest run",
  "test:watch": "vitest",
  "e2e": "playwright test",
  "db:start": "supabase start",
  "db:stop": "supabase stop",
  "db:reset": "supabase db reset",
  "db:migrate": "supabase migration up --local"
}
```

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: prettier + husky + lint-staged"
```

---

## Task 4: Vitest + React Testing Library

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`

- [ ] **Step 1: Install**

```bash
pnpm add -D vitest @vitest/ui @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event
```

- [ ] **Step 2: `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/tests/e2e/**', '**/tests/rls/**'],
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
});
```

- [ ] **Step 3: `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());
```

- [ ] **Step 4: Write sanity test at `lib/__tests__/sanity.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('test infra works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run**

Run: `pnpm test`
Expected: 1 test passes.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: vitest + RTL setup"
```

---

## Task 5: Playwright e2e setup

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Install**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

- [ ] **Step 2: `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Verify Playwright installs and runs**

Run: `pnpm exec playwright --version`
Expected: version string printed, no error. No spec files created yet — the smoke spec is written in Task 12 after the `/login` route exists so the assertion has something to match.

- [ ] **Step 4: Commit config only**

```bash
git add -A && git commit -m "chore: playwright config (spec added with login page)"
```

---

## Task 6: Supabase CLI, local stack, apply base schema

**Files:**
- Create: `supabase/config.toml`, `supabase/migrations/20260420000001_base_schema.sql`

- [ ] **Step 1: Install Supabase CLI (host machine)**

Mac: `brew install supabase/tap/supabase`
Linux: follow https://supabase.com/docs/guides/cli

- [ ] **Step 2: Initialize**

```bash
supabase init
```
Expected: `supabase/config.toml` created.

- [ ] **Step 3: Copy the canonical schema into the first migration**

The user's approved `schema.sql` lives at the project root. Move it verbatim:
```bash
mkdir -p supabase/migrations
cp schema.sql supabase/migrations/20260420000001_base_schema.sql
```

- [ ] **Step 4: Start local Supabase**

```bash
supabase start
```
Expected: containers come up, URL/anon-key/service-role-key printed. Save these for `.env.local` in Task 11.

- [ ] **Step 5: Apply migration**

```bash
supabase db reset
```
Expected: schema applied, no errors. All enums, tables, functions, RLS created.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(db): scaffold Supabase + base schema"
```

---

## Task 7: Migration — schema additions (reorder_level, issues.rate, updated_at)

**Files:**
- Create: `supabase/migrations/20260420000002_schema_additions.sql`

- [ ] **Step 1: Write migration**

```sql
-- 20260420000002_schema_additions.sql
-- Adds: reorder_level on items, rate on issues, updated_at on mutable tables.

ALTER TABLE items
  ADD COLUMN reorder_level NUMERIC CHECK (reorder_level IS NULL OR reorder_level >= 0);

ALTER TABLE issues
  ADD COLUMN rate NUMERIC CHECK (rate IS NULL OR rate >= 0);

ALTER TABLE purchases ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE issues    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_issues_updated_at
  BEFORE UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- [ ] **Step 2: Apply + verify**

Run: `supabase db reset`
Expected: no errors. Confirm columns exist:
```bash
supabase db diff --local
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(db): add reorder_level, issues.rate, updated_at triggers"
```

---

## Task 8: Migration — audit log table + triggers

**Files:**
- Create: `supabase/migrations/20260420000003_audit_log.sql`

- [ ] **Step 1: Write migration**

```sql
-- 20260420000003_audit_log.sql
-- Captures every UPDATE on purchases and issues.
-- Reason flows in via a session-local GUC: SET LOCAL app.edit_reason = '...'.

CREATE TABLE inventory_edit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  TEXT NOT NULL CHECK (table_name IN ('purchases', 'issues')),
  row_id      UUID NOT NULL,
  changed_by  UUID REFERENCES profiles(id),
  changed_at  TIMESTAMPTZ DEFAULT now(),
  reason      TEXT,
  before_data JSONB NOT NULL,
  after_data  JSONB NOT NULL
);

CREATE INDEX idx_edit_log_table_row   ON inventory_edit_log(table_name, row_id);
CREATE INDEX idx_edit_log_changed_at  ON inventory_edit_log(changed_at DESC);

ALTER TABLE inventory_edit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "edit_log_select" ON inventory_edit_log
  FOR SELECT USING (
    (
      table_name = 'purchases'
      AND EXISTS (
        SELECT 1 FROM purchases p
        WHERE p.id = row_id
          AND can_user(auth.uid(), p.site_id, 'INVENTORY', 'VIEW')
      )
    )
    OR
    (
      table_name = 'issues'
      AND EXISTS (
        SELECT 1 FROM issues i
        WHERE i.id = row_id
          AND can_user(auth.uid(), i.site_id, 'INVENTORY', 'VIEW')
      )
    )
  );

CREATE OR REPLACE FUNCTION log_inventory_edit()
RETURNS TRIGGER AS $$
DECLARE
  v_reason TEXT;
BEGIN
  -- current_setting with missing_ok=true returns '' if not set.
  v_reason := current_setting('app.edit_reason', true);

  INSERT INTO inventory_edit_log (
    table_name, row_id, changed_by, reason, before_data, after_data
  )
  VALUES (
    TG_TABLE_NAME,
    NEW.id,
    auth.uid(),
    NULLIF(v_reason, ''),
    to_jsonb(OLD),
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_purchases_audit
  AFTER UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION log_inventory_edit();

CREATE TRIGGER trg_issues_audit
  AFTER UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION log_inventory_edit();
```

- [ ] **Step 2: Apply + verify via psql**

```bash
supabase db reset
supabase db psql --local -c "\d inventory_edit_log"
```
Expected: table structure printed.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(db): add inventory edit audit log + triggers"
```

---

## Task 9: Migration — masters RLS policies

**Files:**
- Create: `supabase/migrations/20260420000004_masters_rls.sql`

- [ ] **Step 1: Helper predicate**

```sql
-- 20260420000004_masters_rls.sql
-- Masters (items, parties, sites) are tenant-wide. Any authenticated user
-- can SELECT. Only SUPER_ADMIN globally, or ADMIN on any site, can write.

CREATE OR REPLACE FUNCTION is_admin_anywhere(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role_id INTO v_role FROM profiles
   WHERE id = p_user_id AND is_active = true;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_role = 'SUPER_ADMIN' THEN RETURN true; END IF;

  RETURN EXISTS (
    SELECT 1 FROM site_user_access
     WHERE user_id = p_user_id AND role_id IN ('SUPER_ADMIN', 'ADMIN')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_user_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_select_all" ON items
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "items_write_admin" ON items
  FOR ALL USING (is_admin_anywhere(auth.uid()))
  WITH CHECK (is_admin_anywhere(auth.uid()));

CREATE POLICY "parties_select_all" ON parties
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "parties_write_admin" ON parties
  FOR ALL USING (is_admin_anywhere(auth.uid()))
  WITH CHECK (is_admin_anywhere(auth.uid()));

CREATE POLICY "sites_select_accessible" ON sites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
       WHERE id = auth.uid() AND role_id = 'SUPER_ADMIN'
    )
    OR EXISTS (
      SELECT 1 FROM site_user_access
       WHERE user_id = auth.uid() AND site_id = sites.id
    )
  );
CREATE POLICY "sites_write_admin" ON sites
  FOR ALL USING (is_admin_anywhere(auth.uid()))
  WITH CHECK (is_admin_anywhere(auth.uid()));

-- profiles: user sees own profile; admins see all.
CREATE POLICY "profiles_select_self_or_admin" ON profiles
  FOR SELECT USING (
    id = auth.uid() OR is_admin_anywhere(auth.uid())
  );
CREATE POLICY "profiles_update_self_or_admin" ON profiles
  FOR UPDATE USING (
    id = auth.uid() OR is_admin_anywhere(auth.uid())
  );

CREATE POLICY "sua_select_self_or_admin" ON site_user_access
  FOR SELECT USING (
    user_id = auth.uid() OR is_admin_anywhere(auth.uid())
  );
CREATE POLICY "sua_write_admin" ON site_user_access
  FOR ALL USING (is_admin_anywhere(auth.uid()))
  WITH CHECK (is_admin_anywhere(auth.uid()));
```

- [ ] **Step 2: Apply**

```bash
supabase db reset
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(db): RLS policies for masters + profiles + site_user_access"
```

---

## Task 10: RLS test harness

**Files:**
- Create: `tests/rls/helpers.ts`, `tests/rls/masters.test.ts`

- [ ] **Step 1: Install test deps**

```bash
pnpm add -D @supabase/supabase-js dotenv
```

- [ ] **Step 2: Write helper at `tests/rls/helpers.ts`**

```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function service(): SupabaseClient {
  return createClient(URL, SERVICE, { auth: { persistSession: false } });
}

export async function asUser(email: string): Promise<SupabaseClient> {
  const admin = service();
  // ensure user exists
  const { data: list } = await admin.auth.admin.listUsers();
  let user = list?.users.find((u) => u.email === email);
  if (!user) {
    const { data } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: 'test-password-1234',
    });
    user = data.user!;
  }
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password: 'test-password-1234' });
  return client;
}

export async function setGlobalRole(userId: string, roleId: string) {
  await service().from('profiles').update({ role_id: roleId }).eq('id', userId);
}
```

- [ ] **Step 3: Write the first policy test at `tests/rls/masters.test.ts`**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { asUser, service, setGlobalRole } from './helpers';

describe('masters RLS', () => {
  it('VIEWER cannot insert an item', async () => {
    const viewer = await asUser('viewer@test.local');
    const { data: who } = await viewer.auth.getUser();
    await setGlobalRole(who.user!.id, 'VIEWER');

    const { error } = await viewer.from('items').insert({
      name: 'Test', unit: 'NOS', code: 'T-001',
    });
    expect(error).not.toBeNull();
  });

  it('SUPER_ADMIN can insert an item', async () => {
    const admin = await asUser('sa@test.local');
    const { data: who } = await admin.auth.getUser();
    await setGlobalRole(who.user!.id, 'SUPER_ADMIN');

    const { error } = await admin.from('items').insert({
      name: 'Rebar 8mm', unit: 'MT', code: 'REB-8',
    });
    expect(error).toBeNull();

    // cleanup
    await service().from('items').delete().eq('code', 'REB-8');
  });
});
```

- [ ] **Step 4: Add `test:rls` script**

In `package.json`:
```json
"test:rls": "vitest run tests/rls"
```

Update `vitest.config.ts` — add a second config OR include `tests/rls/**` explicitly under `include`. Simplest: create `vitest.rls.config.ts` that includes only `tests/rls/**` and uses `node` environment. Example:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    environment: 'node',
    include: ['tests/rls/**/*.test.ts'],
    testTimeout: 20_000,
  },
});
```

Update `test:rls` to `vitest run -c vitest.rls.config.ts`.

- [ ] **Step 5: Run**

```bash
pnpm test:rls
```
Expected: 2 tests pass. (Requires `supabase start` running and `.env.local` populated — Task 11.) If run before Task 11, the test file is written but will be executed as part of Task 11's verification.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "test(rls): harness + masters policy tests"
```

---

## Task 11: Environment + Supabase client setup

**Files:**
- Create: `.env.local.example`, `lib/supabase/{browser,server,middleware}.ts`, `middleware.ts`

- [ ] **Step 1: Install Supabase helpers**

```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
```
Copy to `.env.local` and paste real keys.

- [ ] **Step 3: `lib/supabase/browser.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

export const supabaseBrowser = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
```

- [ ] **Step 4: `lib/supabase/server.ts`**

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );
}
```

- [ ] **Step 5: `lib/supabase/middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth');

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return response;
}
```

- [ ] **Step 6: `middleware.ts` (root)**

```ts
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico)$).*)'],
};
```

- [ ] **Step 7: Generate DB types**

```bash
supabase gen types typescript --local > lib/supabase/types.ts
```
Expected: `lib/supabase/types.ts` with `Database` export.

- [ ] **Step 8: Verify build**

`pnpm typecheck && pnpm build`
Expected: both pass.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(auth): supabase clients + session middleware + typegen"
```

---

## Task 12: Google OAuth + login page

**Files:**
- Create: `app/(auth)/login/page.tsx`, `app/(auth)/auth/callback/route.ts`, `app/(auth)/pending/page.tsx`
- Modify: `supabase/config.toml` (enable Google provider)

- [ ] **Step 1: Enable Google in `supabase/config.toml`**

Under `[auth.external.google]`:
```toml
[auth.external.google]
enabled = true
client_id = "env(GOOGLE_CLIENT_ID)"
secret = "env(GOOGLE_SECRET)"
redirect_uri = "http://127.0.0.1:54321/auth/v1/callback"
```
Add `GOOGLE_CLIENT_ID` and `GOOGLE_SECRET` to `.env.local.example` with blank values and instructions to create via Google Cloud Console (OAuth client type: Web application, authorized redirect URI = above).

- [ ] **Step 2: `app/(auth)/login/page.tsx`**

```tsx
'use client';
import { Button } from '@/components/ui/button';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function LoginPage() {
  const onSignIn = async () => {
    const supabase = supabaseBrowser();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-gray-50">
      <div className="w-[360px] rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">GEI Inventory</h1>
        <p className="mb-6 text-sm text-gray-600">Sign in with your Google account.</p>
        <Button className="w-full" onClick={onSignIn}>
          Sign in with Google
        </Button>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: OAuth callback `app/(auth)/auth/callback/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (code) {
    const supabase = await supabaseServer();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL('/dashboard', url.origin));
}
```

- [ ] **Step 4: `app/(auth)/pending/page.tsx`**

```tsx
export default function PendingPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-gray-50 p-6">
      <div className="max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
        <h1 className="mb-2 text-lg font-semibold">Waiting for admin approval</h1>
        <p className="text-sm text-gray-600">
          Your account has been created. An administrator needs to grant you
          access to a site before you can use the application.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Add placeholder dashboard so redirect lands somewhere**

`app/(app)/layout.tsx`:
```tsx
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

`app/(app)/dashboard/page.tsx`:
```tsx
export default function DashboardPage() {
  return <main className="p-6"><h1>Dashboard — placeholder</h1></main>;
}
```

- [ ] **Step 6: Add smoke spec `tests/e2e/smoke.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('home redirects to login when unauthenticated', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();
});
```

- [ ] **Step 7: Smoke test Playwright passes**

Run: `pnpm e2e`
Expected: `smoke.spec.ts` passes (redirect-to-login, login button visible).

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(auth): google oauth + login + callback + pending + smoke e2e"
```

---

## Task 13: Permission library (`can()` + `PermissionGate`)

**Files:**
- Create: `lib/permissions/{types,can}.ts`, `lib/permissions/__tests__/can.test.ts`, `components/permission-gate.tsx`, `components/__tests__/permission-gate.test.tsx`

- [ ] **Step 1: `lib/permissions/types.ts`**

```ts
export type ModuleId = 'INVENTORY' | 'DPR' | 'LABOUR' | 'LOCATION' | 'REPORTS';
export type ActionId = 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE' | 'EXPORT';
export type RoleId =
  | 'SUPER_ADMIN' | 'ADMIN' | 'STORE_MANAGER' | 'SITE_ENGINEER' | 'VIEWER';

export interface PermissionKey {
  siteId: string;
  module: ModuleId;
  action: ActionId;
}
```

- [ ] **Step 2: Failing test at `lib/permissions/__tests__/can.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createCan } from '../can';

describe('createCan', () => {
  it('returns true when RPC returns true', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const can = createCan({ rpc } as any);
    const allowed = await can({ siteId: 'S1', module: 'INVENTORY', action: 'VIEW' });
    expect(allowed).toBe(true);
    expect(rpc).toHaveBeenCalledWith('can_user', {
      p_user_id: expect.any(String),
      p_site_id: 'S1',
      p_module_id: 'INVENTORY',
      p_action_id: 'VIEW',
    });
  });

  it('returns false when RPC errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'x' } });
    const can = createCan({ rpc } as any);
    expect(await can({ siteId: 'S1', module: 'INVENTORY', action: 'VIEW' })).toBe(false);
  });

  it('caches repeated lookups within a session', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const can = createCan({ rpc } as any);
    await can({ siteId: 'S1', module: 'INVENTORY', action: 'VIEW' });
    await can({ siteId: 'S1', module: 'INVENTORY', action: 'VIEW' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run — verify it fails**

`pnpm test lib/permissions`
Expected: FAIL — `createCan` not defined.

- [ ] **Step 4: Implement `lib/permissions/can.ts`**

```ts
import type { PermissionKey } from './types';

type RpcClient = {
  rpc: (fn: string, params: Record<string, unknown>) => Promise<{
    data: unknown;
    error: unknown;
  }>;
  auth?: { getUser: () => Promise<{ data: { user: { id: string } | null } }> };
};

/**
 * Creates a memoized permission-check function.
 *
 * Cache is per-call-signature (siteId × module × action) and lasts the
 * lifetime of the returned `can` function. Recreate on sign-in/out.
 */
export function createCan(client: RpcClient, userId?: string) {
  const cache = new Map<string, Promise<boolean>>();

  const resolveUserId = async () => {
    if (userId) return userId;
    const { data } = (await client.auth?.getUser()) ?? { data: { user: null } };
    return data.user?.id ?? '';
  };

  return async function can(key: PermissionKey): Promise<boolean> {
    const cacheKey = `${key.siteId}:${key.module}:${key.action}`;
    const hit = cache.get(cacheKey);
    if (hit) return hit;

    const promise = (async () => {
      const uid = await resolveUserId();
      const { data, error } = await client.rpc('can_user', {
        p_user_id: uid,
        p_site_id: key.siteId,
        p_module_id: key.module,
        p_action_id: key.action,
      });
      if (error) return false;
      return Boolean(data);
    })();

    cache.set(cacheKey, promise);
    return promise;
  };
}
```

- [ ] **Step 5: Run tests — verify pass**

`pnpm test lib/permissions`
Expected: 3 pass.

- [ ] **Step 6: `components/permission-gate.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { createCan } from '@/lib/permissions/can';
import type { ModuleId, ActionId } from '@/lib/permissions/types';

const canFn = createCan(supabaseBrowser());

type Props = {
  siteId: string;
  module: ModuleId;
  action: ActionId;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

/**
 * Hides children unless the current user is allowed the module×action
 * on the given site. Purely presentational — RLS at the DB layer is
 * the source of truth for data access.
 */
export function PermissionGate({ siteId, module, action, children, fallback = null }: Props) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    canFn({ siteId, module, action }).then((a) => alive && setAllowed(a));
    return () => { alive = false; };
  }, [siteId, module, action]);
  if (allowed === null) return null;
  return <>{allowed ? children : fallback}</>;
}
```

- [ ] **Step 7: Component test `components/__tests__/permission-gate.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/supabase/browser', () => ({
  supabaseBrowser: () => ({
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u' } } }) },
  }),
}));

import { PermissionGate } from '../permission-gate';

describe('PermissionGate', () => {
  it('renders children when allowed', async () => {
    render(
      <PermissionGate siteId="S1" module="INVENTORY" action="VIEW">
        <span>allowed</span>
      </PermissionGate>,
    );
    await waitFor(() => expect(screen.getByText('allowed')).toBeInTheDocument());
  });
});
```

- [ ] **Step 8: Run**

`pnpm test`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(permissions): can() + PermissionGate with tests"
```

---

## Task 14: Site switcher (Zustand store + component)

**Files:**
- Create: `lib/stores/site.ts`, `components/site-switcher.tsx`

- [ ] **Step 1: Install Zustand**

```bash
pnpm add zustand
```

- [ ] **Step 2: `lib/stores/site.ts`**

```ts
'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Site = { id: string; name: string; code: string };

interface SiteStore {
  currentSite: Site | null;
  sites: Site[];
  setCurrentSite: (s: Site) => void;
  setSites: (list: Site[]) => void;
}

export const useSiteStore = create<SiteStore>()(
  persist(
    (set) => ({
      currentSite: null,
      sites: [],
      setCurrentSite: (s) => set({ currentSite: s }),
      setSites: (list) => set({ sites: list }),
    }),
    { name: 'gei:site' },
  ),
);
```

- [ ] **Step 3: `components/site-switcher.tsx`**

```tsx
'use client';
import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useSiteStore } from '@/lib/stores/site';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export function SiteSwitcher() {
  const { sites, currentSite, setSites, setCurrentSite } = useSiteStore();

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser()
        .from('sites')
        .select('id, name, code')
        .order('name');
      if (data) {
        setSites(data);
        if (!currentSite && data[0]) setCurrentSite(data[0]);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sites.length) return null;

  return (
    <Select
      value={currentSite?.id}
      onValueChange={(id) => {
        const s = sites.find((x) => x.id === id);
        if (s) setCurrentSite(s);
      }}
    >
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Select site" />
      </SelectTrigger>
      <SelectContent>
        {sites.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.code} — {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 4: Verify typecheck**

`pnpm typecheck`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(app): site switcher (zustand + component)"
```

---

## Task 15: AppShell

**Files:**
- Create: `components/app-shell.tsx`
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: `components/app-shell.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { SiteSwitcher } from './site-switcher';
import { Button } from '@/components/ui/button';
import { supabaseBrowser } from '@/lib/supabase/browser';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/inventory/transactions', label: 'Transactions' },
  { href: '/inventory/inward/new', label: '+ Inward' },
  { href: '/inventory/outward/new', label: '+ Outward' },
  { href: '/inventory/pivot', label: 'Pivot' },
  { href: '/masters/items', label: 'Masters' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="print:hide flex items-center justify-between border-b bg-white px-4 py-2">
        <div className="flex items-center gap-4">
          <span className="font-semibold">GEI</span>
          <SiteSwitcher />
        </div>
        <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
      </header>

      <div className="flex flex-1">
        <nav className="print:hide w-52 border-r bg-gray-50 p-3 text-sm">
          {NAV.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className="block rounded px-2 py-1.5 hover:bg-gray-200"
            >
              {i.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 overflow-auto p-4">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Use it in `app/(app)/layout.tsx`**

```tsx
import { AppShell } from '@/components/app-shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 3: Verify build**

`pnpm build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(app): AppShell with sidebar nav + site switcher"
```

---

## Task 16: SearchableSelect

**Files:**
- Create: `components/searchable-select.tsx`, `components/__tests__/searchable-select.test.tsx`

- [ ] **Step 1: Failing test**

`components/__tests__/searchable-select.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchableSelect } from '../searchable-select';

const options = [
  { value: '1', label: 'Cement OPC 53' },
  { value: '2', label: 'Rebar 8mm' },
  { value: '3', label: 'Cement PPC' },
];

describe('SearchableSelect', () => {
  it('filters by label', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchableSelect options={options} value={null} onChange={onChange} placeholder="Item" />);
    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByRole('textbox'), 'rebar');
    expect(screen.getByText('Rebar 8mm')).toBeInTheDocument();
    expect(screen.queryByText('Cement OPC 53')).not.toBeInTheDocument();
  });

  it('fires onChange with the selected value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchableSelect options={options} value={null} onChange={onChange} placeholder="Item" />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Rebar 8mm'));
    expect(onChange).toHaveBeenCalledWith('2');
  });
});
```

- [ ] **Step 2: Run — verify fail**

`pnpm test searchable-select`
Expected: FAIL.

- [ ] **Step 3: Implement `components/searchable-select.tsx`**

```tsx
'use client';
import { useState } from 'react';
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SearchableOption<V extends string = string> = {
  value: V;
  label: string;
  sub?: string;
  group?: string;
};

type Props<V extends string> = {
  options: SearchableOption<V>[];
  value: V | null;
  onChange: (v: V) => void;
  placeholder?: string;
  disabled?: boolean;
};

/**
 * Accessible typeahead select. Groups options by `group` when provided.
 * Keyboard: Enter to open/select, arrow keys to navigate, Esc to close.
 */
export function SearchableSelect<V extends string = string>({
  options, value, onChange, placeholder, disabled,
}: Props<V>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  const grouped = options.reduce<Record<string, SearchableOption<V>[]>>((acc, o) => {
    const k = o.group ?? '';
    (acc[k] ??= []).push(o);
    return acc;
  }, {});

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          variant="outline"
          className="w-full justify-between"
        >
          {selected ? selected.label : <span className="text-gray-400">{placeholder ?? 'Select'}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            {Object.entries(grouped).map(([group, list]) => (
              <CommandGroup key={group} heading={group || undefined}>
                {list.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={`${o.label} ${o.sub ?? ''}`}
                    onSelect={() => { onChange(o.value); setOpen(false); }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === o.value ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex flex-col">
                      <span>{o.label}</span>
                      {o.sub && <span className="text-xs text-gray-500">{o.sub}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Run — verify pass**

`pnpm test searchable-select`
Expected: 2 pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(ui): SearchableSelect with grouping + tests"
```

---

## Task 17: DataGrid

**Files:**
- Create: `components/data-grid.tsx`, `components/__tests__/data-grid.test.tsx`

- [ ] **Step 1: Install TanStack Table**

```bash
pnpm add @tanstack/react-table
```

- [ ] **Step 2: Failing test**

`components/__tests__/data-grid.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataGrid } from '../data-grid';

const cols = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'qty',  header: 'Qty' },
];
const rows = [
  { name: 'Cement', qty: 100 },
  { name: 'Rebar',  qty: 50 },
];

describe('DataGrid', () => {
  it('renders headers and rows', () => {
    render(<DataGrid columns={cols as any} data={rows} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Cement')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('renders the row-number gutter when showRowNumbers', () => {
    render(<DataGrid columns={cols as any} data={rows} showRowNumbers />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run — verify fail**

`pnpm test data-grid`
Expected: FAIL.

- [ ] **Step 4: Implement `components/data-grid.tsx`**

```tsx
'use client';
import {
  ColumnDef, flexRender, getCoreRowModel, getSortedRowModel,
  SortingState, useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';

type Props<T> = {
  columns: ColumnDef<T, any>[];
  data: T[];
  showRowNumbers?: boolean;
  emptyMessage?: string;
};

/**
 * Excel-styled table wrapper around TanStack Table.
 * - Monospace numbers, sticky header/first column
 * - Click column header to sort
 * - Optional row-number gutter (like Excel)
 */
export function DataGrid<T>({
  columns, data, showRowNumbers = false, emptyMessage = 'No rows',
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!data.length) return <div className="p-8 text-center text-sm text-gray-500">{emptyMessage}</div>;

  return (
    <div className="overflow-auto">
      <table className="excel-grid w-full border-collapse">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {showRowNumbers && <th className="row-num w-10">#</th>}
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  onClick={h.column.getToggleSortingHandler()}
                  className="cursor-pointer select-none"
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {{ asc: ' ▲', desc: ' ▼' }[h.column.getIsSorted() as string] ?? ''}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, i) => (
            <tr key={row.id}>
              {showRowNumbers && <td className="row-num">{i + 1}</td>}
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Run — verify pass**

`pnpm test data-grid`
Expected: 2 pass.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(ui): DataGrid (TanStack Table + Excel styles)"
```

---

## Task 18: CSV exporter

**Files:**
- Create: `lib/exporters/csv.ts`, `lib/exporters/__tests__/csv.test.ts`

- [ ] **Step 1: Failing test**

`lib/exporters/__tests__/csv.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { toCSV } from '../csv';

describe('toCSV', () => {
  it('renders header and rows', () => {
    const out = toCSV({
      columns: [
        { key: 'name', header: 'Name' },
        { key: 'qty',  header: 'Qty' },
      ],
      rows: [{ name: 'Cement', qty: 100 }, { name: 'Rebar', qty: 50 }],
    });
    expect(out).toBe('\uFEFFName,Qty\nCement,100\nRebar,50');
  });

  it('escapes quotes, commas, and newlines', () => {
    const out = toCSV({
      columns: [{ key: 'x', header: 'X' }],
      rows: [{ x: 'hello, "friend"\nworld' }],
    });
    expect(out).toBe('\uFEFFX\n"hello, ""friend""\nworld"');
  });

  it('handles null/undefined as empty', () => {
    const out = toCSV({
      columns: [{ key: 'x', header: 'X' }],
      rows: [{ x: null }, { x: undefined }],
    });
    expect(out).toBe('\uFEFFX\n\n');
  });
});
```

- [ ] **Step 2: Run — verify fail**

`pnpm test csv`
Expected: FAIL — `toCSV` not defined.

- [ ] **Step 3: Implement `lib/exporters/csv.ts`**

```ts
export type CsvColumn<T> = { key: keyof T; header: string };
export type CsvInput<T> = { columns: CsvColumn<T>[]; rows: T[] };

const NEEDS_QUOTE = /[",\n\r]/;

function escape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return NEEDS_QUOTE.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Produces a UTF-8-BOM-prefixed CSV string. The BOM makes Excel on Windows
 * detect UTF-8 correctly without a user prompt. Use `downloadCSV` to send
 * it to the browser.
 */
export function toCSV<T>({ columns, rows }: CsvInput<T>): string {
  const BOM = '\uFEFF';
  const head = columns.map((c) => escape(c.header)).join(',');
  const body = rows
    .map((r) => columns.map((c) => escape(r[c.key])).join(','))
    .join('\n');
  return `${BOM}${head}\n${body}`;
}

export function downloadCSV<T>(filename: string, input: CsvInput<T>) {
  const blob = new Blob([toCSV(input)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run — verify pass**

`pnpm test csv`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(exporters): CSV writer + tests"
```

---

## Task 19: XLSX exporter

**Files:**
- Create: `lib/exporters/xlsx.ts`, `lib/exporters/__tests__/xlsx.test.ts`

- [ ] **Step 1: Install**

```bash
pnpm add exceljs
```

- [ ] **Step 2: Failing test**

`lib/exporters/__tests__/xlsx.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildXlsx } from '../xlsx';

describe('buildXlsx', () => {
  it('emits a workbook with frozen header and the expected rows', async () => {
    const buf = await buildXlsx({
      sheetName: 'Stock',
      columns: [
        { key: 'name', header: 'Name' },
        { key: 'qty',  header: 'Qty', numFmt: '#,##0.00' },
      ],
      rows: [
        { name: 'Cement', qty: 100 },
        { name: 'Rebar',  qty: 50 },
      ],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet('Stock')!;
    expect(ws.getCell('A1').value).toBe('Name');
    expect(ws.getCell('B2').value).toBe(100);
    expect(ws.views[0]?.state).toBe('frozen');
    expect(ws.views[0]?.ySplit).toBe(1);
  });
});
```

- [ ] **Step 3: Run — verify fail**

`pnpm test xlsx`
Expected: FAIL.

- [ ] **Step 4: Implement `lib/exporters/xlsx.ts`**

```ts
import ExcelJS from 'exceljs';

export type XlsxColumn<T> = {
  key: keyof T;
  header: string;
  width?: number;
  numFmt?: string;
};

export type XlsxInput<T> = {
  sheetName: string;
  columns: XlsxColumn<T>[];
  rows: T[];
};

/**
 * Builds an XLSX buffer with: frozen header row, bold headers,
 * auto-filter on header, auto-width (from column.width or content).
 * Pass the buffer straight to a Blob for download.
 */
export async function buildXlsx<T>({
  sheetName, columns, rows,
}: XlsxInput<T>): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);

  ws.columns = columns.map((c) => ({
    header: c.header,
    key: String(c.key),
    width: c.width ?? Math.max(12, c.header.length + 2),
    style: c.numFmt ? { numFmt: c.numFmt } : {},
  }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  rows.forEach((r) => ws.addRow(r));

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

export async function downloadXlsx<T>(filename: string, input: XlsxInput<T>) {
  const buf = await buildXlsx(input);
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 5: Run — verify pass**

`pnpm test xlsx`
Expected: 1 pass.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(exporters): XLSX writer (frozen header, auto-filter) + tests"
```

---

## Task 20: ExportButton + PrintButton

**Files:**
- Create: `components/export-button.tsx`, `components/print-button.tsx`

- [ ] **Step 1: `components/export-button.tsx`**

```tsx
'use client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download } from 'lucide-react';
import { downloadCSV } from '@/lib/exporters/csv';
import { downloadXlsx } from '@/lib/exporters/xlsx';

type Col<T> = { key: keyof T; header: string; numFmt?: string };

type Props<T> = {
  filename: string;
  sheetName?: string;
  columns: Col<T>[];
  rows: T[];
};

export function ExportButton<T>({ filename, sheetName, columns, rows }: Props<T>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => downloadCSV(`${filename}.csv`, { columns, rows })}>
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            downloadXlsx(`${filename}.xlsx`, {
              sheetName: sheetName ?? 'Sheet1',
              columns,
              rows,
            })
          }
        >
          Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: `components/print-button.tsx`**

```tsx
'use client';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <Printer className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
```

- [ ] **Step 3: Verify typecheck + build**

`pnpm typecheck && pnpm build`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(ui): ExportButton + PrintButton"
```

---

## Task 21: Empty state + confirm dialog helpers

**Files:**
- Create: `components/empty-state.tsx`, `components/confirm-dialog.tsx`

- [ ] **Step 1: `components/empty-state.tsx`**

```tsx
type Props = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-white p-12 text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-gray-600">{description}</p>}
      {action}
    </div>
  );
}
```

- [ ] **Step 2: `components/confirm-dialog.tsx`**

```tsx
'use client';
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

type Props = {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  title: string;
  description?: string;
  requireReason?: boolean;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: (reason?: string) => void | Promise<void>;
};

/**
 * Generic confirm dialog. When requireReason=true, the user must type a
 * non-empty reason before the Confirm button enables. Used for inline
 * edits and soft-delete actions so audit trails have context.
 */
export function ConfirmDialog({
  open, onOpenChange, title, description, requireReason,
  confirmLabel = 'Confirm', destructive, onConfirm,
}: Props) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const canConfirm = !requireReason || reason.trim().length > 0;

  const handle = async () => {
    setBusy(true);
    try {
      await onConfirm(reason.trim() || undefined);
      onOpenChange(false);
      setReason('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <p className="text-sm text-gray-600">{description}</p>}
        </DialogHeader>
        {requireReason && (
          <div className="grid gap-2">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this change being made?"
              autoFocus
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={!canConfirm || busy}
            onClick={handle}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(ui): EmptyState + ConfirmDialog (with reason capture)"
```

---

## Task 22: Documentation — README, architecture, permissions

**Files:**
- Create/modify: `README.md`, `docs/architecture.md`, `docs/permissions.md`

- [ ] **Step 1: Write `README.md`**

```md
# GEI Inventory

Construction-site inventory management. Next.js 15 + Supabase. See
[docs/architecture.md](docs/architecture.md) for the big picture and
[docs/superpowers/specs/2026-04-20-gei-inventory-system-design.md](docs/superpowers/specs/2026-04-20-gei-inventory-system-design.md) for the approved design.

## Prerequisites

- Node.js >= 20.11
- pnpm >= 9
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Docker (for local Supabase)

## Setup

```bash
pnpm install
cp .env.local.example .env.local
# fill in Google OAuth + Supabase keys

supabase start            # boots local Postgres + Auth
pnpm db:reset             # applies migrations + seed
pnpm dev                  # http://localhost:3000
```

## Scripts

| Command           | Purpose                                    |
| ----------------- | ------------------------------------------ |
| `pnpm dev`        | Next.js dev server                         |
| `pnpm build`      | Production build                           |
| `pnpm test`       | Vitest unit + component                    |
| `pnpm test:rls`   | Supabase RLS policy tests (needs `supabase start`) |
| `pnpm e2e`        | Playwright                                 |
| `pnpm typecheck`  | TypeScript check                           |
| `pnpm lint`       | ESLint                                     |
| `pnpm db:reset`   | Apply all migrations fresh                 |

## Seeding first SUPER_ADMIN

After the first Google sign-in, run (Supabase SQL Editor):

```sql
UPDATE profiles SET role_id = 'SUPER_ADMIN' WHERE id = '<user-uuid>';
```

## Deploying

Frontend: Vercel. Backend: Supabase Cloud. See [docs/runbooks/deploy.md](docs/runbooks/deploy.md) (written in Phase 3).

## Contributing

- Follow the patterns established in `components/` and `lib/`.
- Every exported symbol in `lib/` gets a unit test.
- Pre-commit runs lint + format + typecheck.
```

- [ ] **Step 2: Write `docs/architecture.md`**

```md
# Architecture

## Stack

- **Frontend:** Next.js 15 App Router, TypeScript strict, Tailwind + shadcn/ui
- **Backend:** Supabase (Postgres + Auth + RLS) — no custom API server
- **Data grids:** TanStack Table v8
- **Forms:** React Hook Form + Zod
- **Data fetching:** TanStack Query v5 + Supabase JS
- **Exports:** exceljs (XLSX) + native string writer (CSV)
- **Testing:** Vitest + RTL (unit/component), Supabase local (RLS), Playwright (e2e)

## Request flow

Browser → Next.js (middleware validates/refreshes session) → React → Supabase JS client (carries user JWT) → Supabase Postgres → RLS policy (calls `can_user`) → data or 401.

For mutations, the server action runs in a Next.js route handler with the user's JWT attached. RLS is the only trust boundary.

## Why RLS as the trust boundary

- We own the DB; we do not own every client.
- A single `can_user(user_id, site_id, module, action)` Postgres function is called from every policy. Any role/permission change updates behavior everywhere at once.
- Frontend `can()` is a UI hint, cached per site, same signature as the DB function.

## File layout

See the spec at `docs/superpowers/specs/2026-04-20-gei-inventory-system-design.md` §5.

## Audit log

Edits and soft-deletes on `purchases` and `issues` are mirrored into `inventory_edit_log` by DB triggers. The reason flows in via a session-local GUC (`SET LOCAL app.edit_reason = '...'`) set by the server action before the UPDATE runs. This cannot be bypassed by a client.
```

- [ ] **Step 3: Write `docs/permissions.md`**

```md
# Permissions

## Model

Three layers, composed by `can_user()`:

1. **Global role** on `profiles.role_id` (default `VIEWER` on sign-up).
2. **Per-site role** on `site_user_access.role_id` — what the user can do on a given site.
3. **Per-permission override** on `site_user_permission_overrides` — narrows or widens individual module×action flags for one user on one site.

SUPER_ADMIN short-circuits the check globally.

## Role × module × action matrix (default)

|                | INVENTORY       | DPR           | LABOUR | LOCATION | REPORTS |
| -------------- | --------------- | ------------- | ------ | -------- | ------- |
| SUPER_ADMIN    | ALL             | ALL           | ALL    | ALL      | ALL     |
| ADMIN          | ALL             | ALL           | ALL    | ALL      | ALL     |
| STORE_MANAGER  | V, C, E, X      | –             | –      | V        | V       |
| SITE_ENGINEER  | V               | V, C, E       | V      | V        | V       |
| VIEWER         | V               | V             | V      | V        | V       |

V=VIEW, C=CREATE, E=EDIT, X=EXPORT. DELETE is never granted; soft-delete via EDIT.

## Extending

Adding a new module is additive:
1. `INSERT INTO modules ...`
2. `INSERT INTO role_permissions ...` rows per role.
3. Add RLS policy on the new table calling `can_user(...)`.
4. Wire UI via `PermissionGate`.

No code change to `can_user()` needed.

## Per-user overrides (worked example)

Grant STORE_MANAGER on Site A an extra DPR.VIEW capability just for this user:

```sql
INSERT INTO site_user_permission_overrides (access_id, module_id, action_id, granted)
VALUES ('<sua.id>', 'DPR', 'VIEW', true);
```
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: README + architecture + permissions"
```

---

## Task 23: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  lint-typecheck-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test

  rls:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: supabase start
      - run: pnpm install --frozen-lockfile
      - name: Load env
        run: |
          echo "NEXT_PUBLIC_SUPABASE_URL=$(supabase status -o env | grep API_URL | cut -d= -f2)" >> $GITHUB_ENV
          echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(supabase status -o env | grep ANON_KEY | cut -d= -f2)" >> $GITHUB_ENV
          echo "SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep SERVICE_ROLE_KEY | cut -d= -f2)" >> $GITHUB_ENV
      - run: pnpm test:rls

  e2e:
    if: github.event_name == 'pull_request' && github.base_ref == 'main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm e2e
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "ci: github actions for lint/typecheck/unit/rls/e2e"
```

---

## Task 24: Verification checkpoint

- [ ] **Step 1: Full local check**

```bash
pnpm install
supabase start
pnpm db:reset
pnpm typecheck
pnpm lint
pnpm test
pnpm test:rls
pnpm build
pnpm e2e
```
Expected: everything green. No warnings about unused imports or `any`.

- [ ] **Step 2: Manual smoke**

1. `pnpm dev` → http://localhost:3000 → redirects to `/login`.
2. Click "Sign in with Google" → OAuth → land on `/dashboard` (placeholder).
3. Top bar shows site switcher (empty until a site is seeded in plan 2).
4. Sidebar links render but route targets 404 until later plans — expected.
5. Open a terminal and run `UPDATE profiles SET role_id = 'SUPER_ADMIN' WHERE id = '<your uid>'` in Supabase Studio. Reload — nothing visible changes at this plan's scope, but sets up testing in plan 2.

- [ ] **Step 3: Tag the foundation release**

```bash
git tag foundation-v0.1
```

---

## Self-review result

Spec coverage traced task-by-task:

- §1–2 (problem / goals) — non-functional, no code required.
- §3 (non-goals) — respected: no PWA, no i18n impl, no PDF, no barcodes.
- §4 (users & roles) — Task 9 (masters RLS) + Task 13 (`can()` + `PermissionGate`).
- §5 (tech stack) — Tasks 1–5.
- §6 (schema additions) — Tasks 7–9.
- §7 (screens) — scaffolded shell and placeholder dashboard in Task 12, 15; full screens in the Masters and Transactions plans that follow.
- §8 (reusable components) — Tasks 14 (site switcher), 15 (AppShell), 16 (SearchableSelect), 17 (DataGrid), 20 (Export/Print), 21 (Empty/Confirm). `StatCard` and `DateRangeFilter` deferred to the plans that first use them.
- §9 (permissions) — Tasks 9, 13, and `docs/permissions.md` in Task 22.
- §10 (export/print) — Tasks 18, 19, 20.
- §11 (testing) — Tasks 4, 5, 10, 13, 16, 17, 18, 19; CI in Task 23.
- §12 (documentation) — Task 22; per-module READMEs land in later plans.
- §13 (observability) — Sentry + Sonner deferred to Masters plan (first user-visible toasts).
- §14 (non-functional defaults) — codified in `.prettierrc`, `tsconfig.json`, global CSS; date/currency utilities land in the plan that first needs them.
- §15 (phasing) — this plan is Phase 1 Foundation.

Placeholder scan: no TBDs or "implement later". Types are consistent: `ModuleId`, `ActionId`, `RoleId`, `PermissionKey` are defined once in `lib/permissions/types.ts` and reused. Exporter input shapes match between `csv.ts` and `xlsx.ts` (both take `{ columns: {key, header, ...}, rows }`). `can()` signature used by `PermissionGate` matches `createCan` return type.

One deferred item surfaced in review: `StatCard` and `DateRangeFilter` from §8 of the spec. Both are first-used by the dashboard (Phase 2). Keeping them out of Foundation avoids building UI with no consumer, which is a YAGNI win. They are explicitly listed as "deferred to the plans that first use them" above so the Masters/Phase-2 plan author does not forget.
