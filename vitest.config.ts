import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/tests/e2e/**', '**/tests/rls/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Per-directory coverage bars. Philosophy:
      //   - Pure logic (validators, permissions) is cheap to test and
      //     business-critical — demand near-total coverage.
      //   - Server actions (`lib/actions/**`) mix validation, RPCs, and
      //     revalidation; 80/70 catches regressions without forcing us
      //     to mock Supabase internals.
      //   - Components get 60/50 because inline-edit flows and async
      //     Supabase state are partially covered by integration + e2e.
      //   - `app/(app)/**` screens deliberately have NO threshold;
      //     they're thin compositions covered by Playwright golden paths.
      //   - Global floor (70/60) is the safety net for new code that
      //     doesn't fall under any specific bucket.
      thresholds: {
        lines: 70,
        branches: 60,
        'lib/validators/**': { lines: 95, branches: 90 },
        'lib/permissions/**': { lines: 95, branches: 90 },
        'lib/actions/**': { lines: 80, branches: 70 },
        'components/**': { lines: 60, branches: 50 },
      },
    },
  },
});
