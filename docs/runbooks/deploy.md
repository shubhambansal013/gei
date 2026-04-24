# Runbook — Deploy to production

Ships the app to Cloudflare Workers (frontend) + Supabase Cloud (backend).

## Prereqs

- Cloudflare account with API Token and Account ID.
- Supabase Cloud project.
- `gh` CLI authenticated.

## 1. Supabase Cloud: project + migrations

(Follow existing Supabase instructions)

## 2. Cloudflare: Setup

1. Create a Cloudflare API Token with `Workers Deployment` permissions.
2. Get your Cloudflare Account ID.
3. Add these as `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to your GitHub repository secrets.

## 3. GitHub Actions: env vars

Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to your GitHub repository variables/secrets.

## 4. Deploy

```bash
git push origin main
```

GitHub Actions will run `pnpm run deploy` which:
1. Builds the Next.js app.
2. Converts it for Cloudflare via `@opennextjs/cloudflare`.
3. Deploys to Cloudflare Workers.
