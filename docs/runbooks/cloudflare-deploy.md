# Runbook — Deploy to Cloudflare Pages

This guide covers setting up and deploying the GEI Inventory frontend to Cloudflare Pages.

## Prereqs

- Cloudflare account
- Cloudflare API Token with `Cloudflare Pages: Edit` permissions
- Cloudflare Account ID
- GitHub repository access

## 1. Cloudflare Pages Project Setup

1. Log in to the Cloudflare Dashboard.
2. Navigate to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Select the `gei-inventory` repository.
4. Set the **Project name** (e.g., `gei-inventory`).
5. For **Production branch**, select `main`.
6. **Build settings**:
   - **Framework preset**: `None` (we handle build via GitHub Actions)
   - **Build command**: `pnpm pages:build`
   - **Build output directory**: `.vercel/output`
7. **Root directory**: `/`
8. Click **Save and Deploy**. (It might fail initially because env vars are missing).

## 2. Environment Variables

In the Cloudflare Pages project settings, navigate to **Settings** > **Environment variables**. Add the following for both **Production** and **Preview**:

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key.
- `NEXT_PUBLIC_ENABLE_EMAIL_SIGNIN`: `false` (for production/staging).

## 3. Compatibility Flags

In **Settings** > **Functions** > **Compatibility flags**:
- Add `nodejs_compat` to both Production and Preview.

## 4. GitHub Actions Secrets

To enable automatic deployment from GitHub Actions, add the following secrets to your GitHub repository (**Settings** > **Secrets and variables** > **Actions**):

- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API Token.
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID.

## 5. Deployment Pipeline

The pipeline is configured in `.github/workflows/deploy.yml`:

### Staging
- Automatically deploys to Cloudflare Pages (as a preview/staging environment) on every push to the `main` branch, after all CI tests pass.

### Production
- Requires manual approval in GitHub Actions.
- Target environment: `production`.
- To trigger:
  1. Go to the **Actions** tab in GitHub.
  2. Select the **Deploy** workflow.
  3. Find the successful staging deploy.
  4. Approve the "Deploy to Production" job.

## 6. Manual Deployment (Optional)

If you need to deploy manually from your local machine:

```bash
pnpm pages:build
pnpx wrangler pages deploy .vercel/output --project-name gei-inventory
```
