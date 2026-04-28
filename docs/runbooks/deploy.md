# Runbook — Deploy to production

This guide describes how to deploy the GEI application using GitHub Actions, including database migrations and Cloudflare Workers deployment.

## Prerequisites

- **Supabase Cloud Project:** A project created on [supabase.com](https://supabase.com/).
- **Cloudflare Account:** An account with [Cloudflare Workers](https://workers.cloudflare.com/) enabled.
- **GitHub Repository:** Where the source code is hosted.

## 1. Supabase Configuration

Retrieve the following from your Supabase project settings:
- **Project Reference ID:** Found in Project Settings > General.
- **Database Password:** The password you set when creating the project.
- **API URL & Anon Key:** Found in Project Settings > API.

## 2. Cloudflare Configuration

1. **API Token:** Create an API Token in Cloudflare with `Workers Deployment` permissions.
2. **Account ID:** Found on the Workers & Pages Overview page in the Cloudflare dashboard.

## 3. GitHub Secrets & Variables

In your GitHub repository, navigate to **Settings > Secrets and variables > Actions**.

### Environment: `prod` (or `staging`)
Create environments for `prod` and `staging` to manage these values per-branch.

#### Variables
| Name | Description |
| --- | --- |
| `SUPABASE_PROJECT_ID` | Your Supabase Project Reference ID |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project API URL |

#### Secrets
| Name | Description |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | [Supabase Personal Access Token](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_DB_PASSWORD` | Your Supabase database password |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase Project Anon Key |
| `CLOUDFLARE_API_TOKEN` | Your Cloudflare API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare Account ID |

## 4. Deployment Workflow

The deployment is managed by `.github/workflows/deploy.yml` and triggers automatically on pushes to `main` (production) and `staging` branches.

### Step 4a: Database Migrations

The workflow implements a safety check to prevent automatic destructive schema changes.

1.  **Safety Check (`check-migrations` job):**
    -   Links to the remote project.
    -   Scans pending migrations for destructive SQL keywords (`DROP`, `TRUNCATE`).
    -   Sets a `destructive` output flag.

2.  **Safe Migrations (`migrate-safe` job):**
    -   Runs automatically if no destructive changes are detected.
    -   Applies migrations using `supabase db push`.

3.  **Destructive Migrations (`migrate-destructive` job):**
    -   Triggered if destructive changes are detected.
    -   Requires **manual approval** via GitHub Environment gates (`prod-destructive` or `staging-destructive`).
    -   Once approved, applies migrations using `supabase db push`.

### Step 4b: Cloudflare Deployment (`deploy` job)
Once migrations are successful, the app is built and deployed:
1. Installs dependencies using `pnpm`.
2. Runs the deployment script (`pnpm run deploy:prod` or `pnpm run deploy:staging`).
3. This script uses `@opennextjs/cloudflare` to build the Next.js app and deploy it as a Cloudflare Worker.

## Manual Trigger
You can also trigger a deployment manually from the **Actions** tab in GitHub by selecting the **Deploy** workflow and clicking **Run workflow**.
