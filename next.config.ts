import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next.js 16 blocks cross-origin requests to /_next dev resources by
  // default. That breaks the client bundle when you visit the dev server
  // via one hostname while HMR serves from another (e.g. browser opens
  // 127.0.0.1:3001, HMR replies from localhost:3001 → blank page).
  //
  // Explicitly allow the two localhost forms + the LAN IP the dev server
  // prints so both the owner and anyone on the same Wi-Fi can load the
  // app during development. Production (`next start`) ignores this list.
  allowedDevOrigins: ['localhost', '127.0.0.1', '10.0.6.19'],
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
