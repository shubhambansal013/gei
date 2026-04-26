import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const UNIQ = Date.now().toString().slice(-6);
const TEST_EMAIL = `e2e-transfer-${UNIQ}@example.com`;
const TEST_PASSWORD = 'test-password-1234';
const SITE_A_CODE = `SA-${UNIQ}`;
const SITE_B_CODE = `SB-${UNIQ}`;
const ITEM_CODE = `ITEM-${UNIQ}`;

test.describe('Site Transfer', () => {
  let supabase: SupabaseClient;
  let testUserId: string;
  let siteAId: string;
  let siteBId: string;
  let itemId: string;

  test.beforeAll(async () => {
    supabase = createClient(URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 1. Create a test user
    const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (createError) throw createError;
    testUserId = user!.id;

    // 2. Create two test sites
    const { data: sites, error: siteError } = await supabase
      .from('sites')
      .insert([
        { code: SITE_A_CODE, name: `Site A ${UNIQ}` },
        { code: SITE_B_CODE, name: `Site B ${UNIQ}` }
      ])
      .select();
    if (siteError) throw siteError;
    siteAId = sites.find(s => s.code === SITE_A_CODE)!.id;
    siteBId = sites.find(s => s.code === SITE_B_CODE)!.id;

    // 3. Create an item
    const { data: item, error: itemError } = await supabase
      .from('items')
      .insert({ code: ITEM_CODE, name: `E2E Item ${UNIQ}`, stock_unit: 'NOS' })
      .select()
      .single();
    if (itemError) throw itemError;
    itemId = item.id;

    // 4. Setup profile and access (ADMIN on both sites)
    await supabase.from('profiles').update({
      role_id: 'ADMIN',
      is_active: true,
      full_name: 'Transfer Tester'
    }).eq('id', testUserId);

    await supabase.from('site_user_access').insert([
      { site_id: siteAId, user_id: testUserId, role_id: 'ADMIN' },
      { site_id: siteBId, user_id: testUserId, role_id: 'ADMIN' }
    ]);
  });

  test.afterAll(async () => {
    if (supabase) {
      await supabase.from('issues').delete().eq('site_id', siteAId);
      await supabase.from('site_user_access').delete().eq('user_id', testUserId);
      await supabase.from('items').delete().eq('id', itemId);
      await supabase.from('sites').delete().in('id', [siteAId, siteBId]);
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  test('should toggle site transfer and submit successfully', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[id="email"]', TEST_EMAIL);
    await page.fill('input[id="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    // Go to New Issue page
    await page.goto('/inventory/outward/new');
    await expect(page.locator('h1')).toHaveText('New issue');

    // Select Site A
    await page.getByRole('combobox', { name: 'Select site' }).click();
    await page.getByRole('option', { name: new RegExp(SITE_A_CODE) }).click();

    // Verify initial state: Location and Party are visible
    await expect(page.getByText('Location', { exact: true })).toBeVisible();
    await expect(page.getByText('Party', { exact: true })).toBeVisible();
    await expect(page.getByText('Destination Site', { exact: true })).not.toBeVisible();

    // Toggle "Transfer to another site"
    await page.click('label[for="isTransfer"]');

    // Verify toggled state: Location and Party are hidden, Destination Site is visible
    await expect(page.getByText('Location', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Party', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Destination Site', { exact: true })).toBeVisible();

    // Fill the rest of the form
    // Select Item
    await page.getByRole('combobox', { name: 'Search items…' }).click();
    await page.getByRole('option', { name: new RegExp(ITEM_CODE) }).click();

    // Qty
    await page.fill('input[id="qty"]', '10');

    // Select Destination Site (Site B)
    await page.getByRole('combobox', { name: 'Select destination site' }).click();
    await page.getByRole('option', { name: new RegExp(SITE_B_CODE) }).click();

    // Issued to (legacy because no workers registered for Site A)
    await page.fill('input[id="issuedTo"]', 'E2E Receiver');

    // Submit
    await page.click('button[type="submit"]');

    // Verify success toast
    await expect(page.getByText('Issue recorded.')).toBeVisible();

    // Verify form cleared
    await expect(page.locator('input[id="qty"]')).toHaveValue('');
  });
});
