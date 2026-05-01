import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const UNIQ = Date.now().toString().slice(-6);
const TEST_EMAIL = `e2e-${UNIQ}@example.com`;
const TEST_PASSWORD = 'test-password-1234';
const SITE_CODE = `S-E2E-${UNIQ}`;

test.describe('Golden Path', () => {
  let supabase: SupabaseClient;
  let testUserId: string;
  let testSiteId: string;

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

    // 2. Create a test site
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .insert({ code: SITE_CODE, name: `E2E Test Site ${UNIQ}` })
      .select()
      .single();
    if (siteError) throw siteError;
    testSiteId = site.id;

    // 3. Setup profile and access (ADMIN on this site)
    await supabase.from('profiles').update({
      role_id: 'ADMIN',
      is_active: true,
      full_name: 'E2E Tester'
    }).eq('id', testUserId);

    await supabase.from('site_user_access').insert({
      site_id: testSiteId,
      user_id: testUserId,
      role_id: 'ADMIN'
    });
  });

  test.afterAll(async () => {
    if (supabase) {
      // Cleanup in reverse order
      await supabase.from('site_user_access').delete().eq('user_id', testUserId);
      await supabase.from('sites').delete().eq('id', testSiteId);
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  test('golden path: login, dashboard and transactions', async ({ page }) => {
    await test.step('Login', async () => {
      await page.goto('/login');
      await page.fill('input[id="email"]', TEST_EMAIL);
      await page.fill('input[id="password"]', TEST_PASSWORD);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/dashboard/);
    });

    await test.step('Dashboard', async () => {
      await expect(page.locator('h1')).toHaveText('Dashboard');
      await expect(page.getByText('Live across every site')).toBeVisible();
    });

    await test.step('Navigate to Transactions', async () => {
      await page.getByRole('link', { name: 'Transactions' }).click();
      await expect(page).toHaveURL(/\/inventory\/transactions/);
      await expect(page.locator('h1')).toHaveText('Transactions');
    });
  });
});
