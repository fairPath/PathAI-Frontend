import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Unit tests for pure modules only. Not a required PR check yet.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
