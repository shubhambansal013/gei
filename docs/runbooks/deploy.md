# Runbook — Deploy to production

Ships the app to Vercel (frontend) + Supabase Cloud (backend). One-time
setup then a `git push` per deploy. ~15 minutes for first-time setup,
zero for subsequent pushes.

## Prereqs

- Vercel account with access to the `gei-inventory` team
- Supabase Cloud project (create at https://supabase.com/dashboard)
- `gh` CLI authenticated against the repo

## 1. Supabase Cloud: project + migrations

```bash
# Link local repo to the Cloud project (one-time)
supabase link --project-ref <your-project-ref>

# Push every migration. Uses the same ordered files in supabase/migrations/
supabase db push

# Generate prod-scoped types
supabase gen types typescript --project-id <your-project-ref> > lib/supabase/types.ts
```

Expected output: all five migrations applied, no errors. Check
`inventory_edit_log`, `items.reorder_level`, `issues.rate` all exist.

## 2. Supabase Cloud: Google OAuth

1. Dashboard → Authentication → Providers → Google → Enabled.
2. Client ID + secret from the `docs/runbooks/google-oauth-setup.md`
   Google Cloud setup. Use a **separate** OAuth client for prod with
   the prod callback URL: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Add your Vercel production URL and preview URLs to "Authorized JavaScript origins".
4. In the Supabase dashboard: Authentication → URL Configuration →
   Site URL = your Vercel prod URL. Redirect URLs = `https://<vercel-url>/auth/callback`.

## 3. Vercel: project + env vars

```bash
vercel link            # link this directory to a Vercel project
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# → paste https://<project-ref>.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# → paste anon key from Supabase dashboard → Project Settings → API

# Service role key is NOT set in Vercel. Period.
# It lives only in CI secrets for RLS tests and never in the frontend.

vercel env add NEXT_PUBLIC_ENABLE_EMAIL_SIGNIN production
# → false   (disables the dev-only email/password fallback)
```

Set the same `NEXT_PUBLIC_*` env vars for the preview environment.

## 4. First deploy

```bash
git push origin main     # CI runs lint + typecheck + unit + RLS
# Vercel picks up the push, runs `pnpm build`, deploys
```

Check the deploy URL:

- `/` redirects to `/login`
- "Continue with Google" lands on a Google consent screen
- After consent, lands on `/dashboard` with real headline KPIs

## 5. Seed the first SUPER_ADMIN

After the first user signs in, Supabase Studio → SQL editor:

```sql
UPDATE profiles SET role_id = 'SUPER_ADMIN'
 WHERE id = (SELECT id FROM auth.users WHERE email = '<you@company.com>');
```

Sign out, sign back in. All routes work. Use `/masters/users` to grant
access to the next users.

## 6. Subsequent deploys

```bash
git push origin main     # that's it
```

- Every push to `main` triggers a Vercel prod deploy
- Every PR triggers a preview deploy + the full CI matrix
- Database migrations are NOT auto-applied. Run `supabase db push`
  manually after merging migration PRs. Add this as a CI step when
  the team grows past solo.

## Rollback

Vercel → Deployments → pick a prior green deploy → "Promote to
production". Takes ~5 seconds. If a migration is part of the bad
deploy, also run `supabase db reset` against a branch DB to test the
rollback migration before applying to prod.

## Monitoring

- **Sentry** (optional, Phase 3): frontend errors. DSN via
  `NEXT_PUBLIC_SENTRY_DSN`.
- **Supabase logs**: dashboard → Logs → Postgres / Auth / Edge. RLS
  denials show up as 401s in the API log.
- **Vercel analytics**: free tier is enough for a multi-site internal
  tool. Observe page-load timings monthly.

## Common failures

- `"Unsupported provider: provider is not enabled"` — Google OAuth not
  turned on, or the Cloud project's callback URL doesn't match the
  Google Cloud console's authorized redirect URI. Fix both sides.
- `"relation 'profiles' does not exist"` on signup — the
  `handle_new_user()` trigger lost its `search_path`. Re-apply
  migration `20260420000005_fix_handle_new_user.sql`.
- Blank page on login after deploy — `allowedDevOrigins` in
  `next.config.ts` only applies to dev; prod blanks are usually a
  failed client bundle. Check browser devtools → Network for 404s on
  `_next/static/*`.
