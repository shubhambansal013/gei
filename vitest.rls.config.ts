import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * RLS suite config. Runs against a LIVE local Supabase instance —
 * `supabase start` must be up and `.env.local` populated. Ships in a
 * separate config because the DB tests need node (not jsdom) and
 * share no setup with the component suite.
 */
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    environment: 'node',
    include: ['tests/rls/**/*.test.ts'],
    testTimeout: 20_000,
    setupFiles: ['dotenv/config'],
  },
});
