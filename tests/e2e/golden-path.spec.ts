import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TEST_EMAIL = 'e2e-test@example.com';
const TEST_PASSWORD = 'test-password-1234';

test.describe('Golden Path', () => {
  test.beforeAll(async () => {
    // Bootstrap test user
    const supabase = createClient(URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Try to create user, ignore if exists
    const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });

    let userId = user?.id;

    if (createError && createError.message.includes('already registered')) {
      const { data: { users } } = await supabase.auth.admin.listUsers();
      userId = users.find(u => u.email === TEST_EMAIL)?.id;
    }

    if (userId) {
      // Ensure profile is active and has a role
      await supabase
        .from('profiles')
        .upsert({
          id: userId,
          role_id: 'SUPER_ADMIN',
          is_active: true,
          full_name: 'E2E Tester'
        });
    }
  });

  test('should login and show dashboard', async ({ page }) => {
    await page.goto('/login');

    // Fill login form
    await page.fill('input[id="email"]', TEST_EMAIL);
    await page.fill('input[id="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify dashboard content
    await expect(page.locator('h1')).toHaveText('Dashboard');
    await expect(page.locator('section[aria-label="Key metrics"]')).toBeVisible();
  });

  test('should navigate to transactions', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[id="email"]', TEST_EMAIL);
    await page.fill('input[id="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    // Click Transactions in sidebar
    await page.click('nav >> text=Transactions');

    // Should be on transactions page
    await expect(page).toHaveURL(/\/inventory\/transactions/);
    await expect(page.locator('h1')).toHaveText('Transactions');
  });
});
