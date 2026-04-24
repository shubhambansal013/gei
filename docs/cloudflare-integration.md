# Cloudflare Integration with @opennextjs/cloudflare

This project is configured to be deployed on Cloudflare Workers using the `@opennextjs/cloudflare` adapter. This adapter allows Next.js applications to run on the Cloudflare Workers runtime, providing a scalable and performant environment.

## Architecture

1.  **Next.js (App Router):** The core application is built with Next.js 16.
2.  **@opennextjs/cloudflare:** An adapter that converts the Next.js build output into a format compatible with Cloudflare Workers.
3.  **Wrangler:** The Cloudflare Workers CLI used for local development, previewing, and deployment.
4.  **Edge Runtime:** The application uses the Edge Runtime for middleware (via `proxy.ts`) to ensure compatibility with Cloudflare Workers.

## Key Configuration Files

-   `wrangler.jsonc`: The main configuration file for Wrangler. It defines the worker name, compatibility date, compatibility flags (`nodejs_compat`), and static asset directory.
-   `open-next.config.ts`: Configuration for the OpenNext adapter.
-   `next.config.ts`: Updated to include `initOpenNextCloudflareForDev()` for better integration during local development.
-   `proxy.ts`: The entry point for middleware, configured with `export const runtime = 'edge';`.
-   `public/_headers`: Defines caching headers for static assets on Cloudflare.

## Deployment Process

The deployment is automated via GitHub Actions (`.github/workflows/deploy.yml`).

1.  **Build:** `next build` is called to generate the standard Next.js build.
2.  **OpenNext Build:** `opennextjs-cloudflare build` takes the Next.js output and creates a `.open-next` directory containing the Worker script and assets.
3.  **Deploy:** `opennextjs-cloudflare deploy` uploads the generated assets and script to Cloudflare Workers.

## Local Development

You can continue to use `pnpm dev` for standard Next.js development. To preview the application in a Workers-like environment, use:

```bash
pnpm run preview
```

This will build the application using OpenNext and run it locally using Wrangler's preview mode.
