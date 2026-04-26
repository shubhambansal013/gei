import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * Golden-path e2e — the full recording loop end-to-end in a real
 * browser:
 *   1. Bootstrap a SUPER_ADMIN test user via service role
 *   2. Seed one site, one item, one supplier via service role (faster +
 *      deterministic than walking the master CRUD through the UI)
 *   3. Sign in via the email fallback form
 *   4. Record an inward (purchase) through the UI
 *   5. Record an outward (issue) through the UI
 *   6. Open the item ledger; expect balance = received - issued
 *
 * This spec requires:
 *   - Supabase local running (supabase start)
 *   - NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY env vars
 *   - The Playwright webServer block in playwright.config.ts which
 *     runs `pnpm build && pnpm start` on :3000
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const skip = !URL || !ANON || !SERVICE;

test.describe('golden path — purchase → issue → ledger balance', () => {
  test.skip(
    skip,
    'Requires NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY env vars + supabase local running',
  );

  const unique = `E2E-${Date.now()}`;
  const email = `e2e-${Date.now()}@test.local`;
  const password = 'e2e-password-12345';
  const siteCode = `S-${unique}`;
  const itemCode = `I-${unique}`;
  const supplierName = `Supplier ${unique}`;

  test.describe.configure({ mode: 'serial' });

  let userId = '';
  let itemId = '';

  test.beforeAll(async () => {
    if (skip) return;
    const svc = createClient(URL!, SERVICE!, { auth: { persistSession: false } });

    // 1. Bootstrap SUPER_ADMIN user
    const created = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    userId = created.data.user!.id;
    const { error: profileError } = await svc.from('profiles').upsert({
      id: userId,
      full_name: 'E2E Admin',
      role_id: 'SUPER_ADMIN',
      is_active: true,
    });
    if (profileError) {
      console.error('Bootstrap: Failed to upsert profile', profileError);
      throw profileError;
    }

    // 2. Seed masters via service role (avoids clicking through 3 forms)
    await svc.from('sites').insert({ code: siteCode, name: `E2E ${unique}` });
    const { data: item } = await svc
      .from('items')
      .insert({ code: itemCode, name: `E2E Cement ${unique}`, stock_unit: 'MT' })
      .select()
      .single();
    itemId = item!.id;
    await svc.from('parties').insert({ name: supplierName, type: 'SUPPLIER' });
  });

  test.afterAll(async () => {
    if (skip || !userId) return;
    const svc = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    await svc.from('inventory_edit_log').delete().eq('row_id', itemId);
    await svc.from('issues').delete().like('unit', 'MT').eq('item_id', itemId);
    await svc.from('purchases').delete().eq('item_id', itemId);
    await svc.from('items').delete().eq('id', itemId);
    await svc.from('sites').delete().eq('code', siteCode);
    await svc.from('parties').delete().eq('name', supplierName);
    await svc.auth.admin.deleteUser(userId);
  });

  async function signIn(page: Page) {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in with email' }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  }

  test('signs in with email fallback and lands on dashboard', async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    // Sidebar brand wordmark and nav render
    await expect(page.locator('nav').getByText('Inventory')).toBeVisible();
    await expect(page.locator('nav').getByText('Transactions')).toBeVisible();
  });

  test('records a purchase transaction', async ({ page }) => {
    await signIn(page);
    await page.goto('/inventory/inward/new');
    await expect(page.getByRole('heading', { name: 'New purchase' })).toBeVisible();

    // Site is auto-selected (first accessible) — just verify it's populated
    // Item: open the combobox, pick the seeded item
    const itemCombo = page.getByRole('combobox', { name: 'Search items…' });
    await itemCombo.click();
    await page.locator('[data-slot="popover-content"]').getByPlaceholder('Search...').fill(itemCode);
    await page.getByRole('option').filter({ hasText: `E2E Cement ${unique}` }).click();

    await page.getByLabel('Qty *').fill('100');

    const supplierCombo = page.getByRole('combobox', { name: 'Pick a party' });
    await supplierCombo.click();
    await page.locator('[data-slot="popover-content"]').getByPlaceholder('Search...').fill(unique);
    await page.getByRole('option').filter({ hasText: supplierName }).click();

    await page.getByLabel('Invoice #').fill(`INV-${unique}`);

    await page.getByRole('button', { name: 'Record purchase' }).click();
    await page.waitForURL(/\/inventory\/transactions/, { timeout: 15_000 });

    // The new row appears — first row should be our PURCHASE transaction
    await expect(page.getByText(`E2E Cement ${unique}`).first()).toBeVisible();
    await expect(page.locator('span').filter({ hasText: /^PURCHASE$/ }).first()).toBeVisible();
  });

  test('records an issue transaction', async ({ page }) => {
    await signIn(page);
    await page.goto('/inventory/outward/new');
    await expect(page.getByRole('heading', { name: 'New issue' })).toBeVisible();

    const itemCombo = page.getByRole('combobox', { name: 'Search items…' });
    await itemCombo.click();
    await page.locator('[data-slot="popover-content"]').getByPlaceholder('Search...').fill(itemCode);
    await page.getByRole('option').filter({ hasText: `E2E Cement ${unique}` }).click();

    await page.getByLabel('Qty *').fill('30');

    // Destination: the supplier (party)
    const destCombo = page.getByRole('combobox', { name: 'Contractor / customer (optional)' });
    await destCombo.click();
    await page.locator('[data-slot="popover-content"]').getByPlaceholder('Search...').fill(unique);
    await page.getByRole('option').filter({ hasText: supplierName }).click();

    await page.getByLabel('Issued to').fill('E2E QA foreman');

    await page.getByRole('button', { name: 'Record issue' }).click();
    await page.waitForURL(/\/inventory\/transactions/, { timeout: 15_000 });

    await expect(page.locator('span').filter({ hasText: /^ISSUE$/ }).first()).toBeVisible();
  });

  test('item ledger shows running balance 100 − 30 = 70', async ({ page }) => {
    await signIn(page);
    await page.goto(`/inventory/item/${itemId}`);

    // Item name + current-stock headline
    await expect(
      page.getByRole('heading', { name: new RegExp(`E2E Cement ${unique}`) }),
    ).toBeVisible();

    // Find the "Current stock" heading and then check the sibling's number
    const currentStockSection = page.locator('text=Current stock').locator('..');
    await expect(currentStockSection).toContainText('70');

    // The ledger body contains both PURCHASE (100) and ISSUE (30) rows, final balance 70
    const ledgerRows = page.locator('table.excel-grid tbody tr');
    await expect(ledgerRows).toHaveCount(2);
    // Final balance cell on the last row
    await expect(ledgerRows.last()).toContainText('70');
  });
});
