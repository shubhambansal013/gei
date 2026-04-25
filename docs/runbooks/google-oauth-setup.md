# Runbook: Enable Google OAuth sign-in

The app's primary sign-in path is Google OAuth. Until you enable a
provider, an email + password fallback on `/login` lets you smoke-test
the app. This runbook enables real Google sign-in.

## 1. Create a Google OAuth client

1. Open https://console.cloud.google.com/apis/credentials.
2. Pick or create a project (e.g. `gei-inventory-local`).
3. Configure the OAuth consent screen (External → "GEI",
   support email = your email, scopes = `email profile openid`, test
   users = your Google address).
4. Click **Create Credentials → OAuth client ID**.
   - Application type: **Web application**
   - Name: `GEI (local)`
   - Authorized JavaScript origins: `http://localhost:3001` (and
     `http://127.0.0.1:3001`)
   - Authorized redirect URIs: `http://127.0.0.1:54321/auth/v1/callback`
     (this is Supabase Auth's callback, NOT the Next.js `/auth/callback`)
5. Copy the **Client ID** and **Client secret**.

## 2. Wire the creds into Supabase local

Add to a new file at the project root — `supabase/.env` (gitignored):

```env
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<your-client-secret>
```

Then flip `enabled = false` → `true` in `supabase/config.toml` under
`[auth.external.google]`.

## 3. Restart Supabase to pick up the config

```bash
supabase stop
supabase start
```

The start output will reprint the anon + service-role keys — they
don't change on restart, but the auth container re-reads config.toml.

## 4. Try it

- Visit `http://localhost:3001/login`.
- Click **Sign in with Google**.
- Google consent screen appears → approve.
- You land on `/dashboard` via the OAuth callback.

## 5. Grant yourself SUPER_ADMIN

New Google sign-ups default to `VIEWER`. Open
`http://127.0.0.1:54323` (Supabase Studio) → SQL editor → run:

```sql
UPDATE profiles SET role_id = 'SUPER_ADMIN'
 WHERE id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
```

After this, you can create sites / items / parties / users via the
Masters screens (once those ship in the Masters plan).

## 6. For production

In the Supabase Cloud dashboard:

1. Authentication → Providers → Google → Enabled.
2. Paste the client ID + secret from your Google OAuth client — you
   likely want a **separate** Google OAuth client with the
   production Supabase callback URL:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. Add your Vercel domain to authorized JS origins.

The `config.toml` and `supabase/.env` are local-only — production
auth config lives in the Supabase dashboard.

## Troubleshooting

- `"Unsupported provider: provider is not enabled"` — `enabled = true`
  is missing in `config.toml`, or Supabase wasn't restarted after the
  edit.
- `"redirect_uri_mismatch"` — the redirect URI in Google Cloud doesn't
  exactly match Supabase's callback. Copy it from the error message.
- Loops back to `/login` after Google consent — `/auth/callback` route
  is failing. Check the dev-server logs; most likely cookies aren't
  setting because of the browser's third-party-cookie policy — use
  `localhost` (not `127.0.0.1`) in the browser so origin matches.
