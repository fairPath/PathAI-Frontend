import { expect, test as base, type Locator, type Page } from '@playwright/test';

import type { Analysis } from '../../src/types/ResumeAnalysis';

const STUB = 'http://127.0.0.1:4010';

export type StubRequest = { method: string; path: string; hasBearer: boolean };

type StubState = {
  user?: Record<string, unknown>;
  latest?: Analysis[];
  analyze?: { status: number; body?: unknown; raw?: string };
  afterAnalyze?: Analysis[] | null;
};

export type Stub = {
  set(state: StubState): Promise<void>;
  requests(): Promise<StubRequest[]>;
};

/** An Analysis as Spring's status read returns it; override what the test cares about. */
export function analysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    analysis_id: '11111111-1111-1111-1111-111111111111',
    status: 'PENDING',
    created_at: '2026-01-01T00:00:00Z',
    error_code: null,
    retryable: null,
    scores: null,
    issues: null,
    model: null,
    pipeline_version: null,
    ...overrides,
  };
}

export const completed = analysis({
  status: 'COMPLETED',
  scores: { formatting: 100, parseability: 100, writing: 100, overall: 100 },
  issues: [],
  pipeline_version: '0.1.0',
});

/**
 * The panel's message. Next also renders an empty role="alert" route announcer,
 * so a bare getByRole('alert') can match two elements: keep only one with text.
 */
export function panelAlert(page: Page): Locator {
  return page.getByRole('alert').filter({ hasText: /\S/ });
}

export const test = base.extend<{ stub: Stub }>({
  // Every test starts from a reset stub and a signed-in browser.
  // Playwright calls the second argument `use`; it is named `provide` here because the
  // react-hooks lint rule reads any function called `use` as a React hook.
  stub: async ({ context, request, baseURL }, provide) => {
    await request.post(`${STUB}/__stub/reset`);
    // src/proxy.ts only checks that the cookie exists; the stub accepts any token.
    await context.addCookies([{ name: 'authToken', value: 'e2e-token', url: baseURL! }]);

    await provide({
      async set(state) {
        const response = await request.post(`${STUB}/__stub/state`, { data: state });
        expect(response.ok()).toBe(true);
      },
      async requests() {
        return (await (await request.get(`${STUB}/__stub/requests`)).json()) as StubRequest[];
      },
    });
  },
});

export { expect };
