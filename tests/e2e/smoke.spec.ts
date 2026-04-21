import { test, expect } from '@playwright/test';

test('homepage redirects to login', async ({ page }) => {
  await page.goto('/');
  expect(page.url()).toContain('/login');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
});

test('login page renders brand wordmark and email fallback form', async ({ page }) => {
  await page.goto('/login');
  expect(page.url()).toContain('/login');

  // Check for brand wordmark (GEI in the header)
  await expect(page.locator('span').filter({ hasText: /^GEI$/ })).toBeVisible();

  // Check for Sign in heading
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  // Check for email input
  const emailInput = page.locator('input[type="email"]');
  await expect(emailInput).toBeVisible();

  // Check for password input
  const passwordInput = page.locator('input[type="password"]');
  await expect(passwordInput).toBeVisible();

  // Check for "Create an account" link
  const createAccountLink = page.getByRole('button', { name: 'Create an account' });
  await expect(createAccountLink).toBeVisible();
});

test('protected routes redirect to login', async ({ page }) => {
  const protectedRoutes = [
    '/dashboard',
    '/masters/items',
    '/inventory/transactions',
    '/inventory/pivot',
    '/inventory/item/some-uuid',
  ];

  for (const route of protectedRoutes) {
    await page.goto(route);
    expect(page.url()).toContain('/login');
  }
});

test('login form can switch between sign-in and sign-up modes', async ({ page }) => {
  await page.goto('/login');

  // Initially should show "Sign in with email"
  const signInButton = page.getByRole('button', { name: 'Sign in with email' });
  await expect(signInButton).toBeVisible();

  // Click "Create an account"
  const createAccountButton = page.getByRole('button', { name: 'Create an account' });
  await createAccountButton.click();

  // Button text should change to "Create account"
  const createAccountSubmitButton = page.getByRole('button', { name: 'Create account' });
  await expect(createAccountSubmitButton).toBeVisible();

  // Find and click "Sign in instead"
  const signInInsteadButton = page.getByRole('button', { name: 'Sign in instead' });
  await signInInsteadButton.click();

  // Should be back to "Sign in with email"
  await expect(signInButton).toBeVisible();
});
