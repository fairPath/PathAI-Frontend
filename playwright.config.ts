import { defineConfig, devices } from '@playwright/test';

// End-to-end tests of the Analysis panel against a stubbed Spring.
// Not a required PR check. See e2e/README.md.
const APP_PORT = 3100;
const STUB_PORT = 4010;

export default defineConfig({
  testDir: './e2e',
  // One stub, one piece of shared state: tests run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    // "localhost", not 127.0.0.1: Next's dev server blocks dev resources requested from other
    // hosts, so the page would load without its client code and every click would do nothing.
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/support/stub-spring.mjs',
      url: `http://127.0.0.1:${STUB_PORT}/__stub/requests`,
      env: { STUB_SPRING_PORT: String(STUB_PORT) },
      // Never reuse a server we did not start: a leftover one could answer with stale state.
      reuseExistingServer: false,
    },
    {
      command: `npx next dev --port ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}/login`,
      env: {
        SPRING_BASE_URL: `http://127.0.0.1:${STUB_PORT}`,
        NEXT_DIST_DIR: '.next-e2e',
      },
      // A dev server already on this port would be pointed at the real Spring: fail loudly instead.
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
