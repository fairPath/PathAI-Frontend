import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: 'synthetic-token' }) })),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('Unexpected redirect');
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { redirect } from 'next/navigation';
import { runAiAction } from './ai-request';
import { aiApiFetch } from './ai-api-client';
import { startAnalysis, getLatestAnalysis } from '@/app/dashboard/profile/action';
import { requestJobComparison } from '@/app/dashboard/search-results/action';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('SPRING_BASE_URL', 'http://synthetic');
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function http(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('all AI actions use the shared request wrapper', () => {
  it.each([null, { correlation_id: null, error_code: 'RESUME_REQUIRED', retryable: 'false' }])(
    'handles malformed permanent failures identically for both features: %#',
    async (body) => {
      fetchMock.mockImplementation(async () => http(body, 422));
      const analysis = await startAnalysis();
      const comparison = await requestJobComparison('job');
      expect(analysis).toEqual(comparison);
      expect(analysis).toMatchObject({ ok: false, retryable: false, errorCode: 'INTERNAL_ERROR' });
    }
  );
  it('preserves validated backend flags and shared messages for both features', async () => {
    fetchMock.mockImplementation(async () =>
      http(
        { correlation_id: 'synthetic', error_code: 'AI_AUTHENTICATION_FAILED', retryable: false },
        422
      )
    );
    const analysis = await startAnalysis();
    expect(await requestJobComparison('job')).toEqual(analysis);
    expect(analysis).toMatchObject({ retryable: false, correlationId: 'synthetic' });
    expect(JSON.stringify(analysis)).not.toMatch(/log in|sign in/i);
  });
  it('normalizes network failure once and never retries in the frontend', async () => {
    fetchMock.mockRejectedValue(new TypeError('Synthetic private network details'));
    expect(await startAnalysis()).toEqual(await requestJobComparison('job'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(await getLatestAnalysis())).not.toContain('private network details');
  });
  it('keeps successful feature-specific responses and handles empty status reads', async () => {
    const analysis = { analysis_id: 'a', status: 'PENDING' };
    fetchMock.mockResolvedValueOnce(http(analysis, 202));
    expect(await startAnalysis()).toEqual({ ok: true, data: analysis });
    const job = { jobId: 'job', saved: true, comparisonStatus: 'PENDING' };
    fetchMock.mockResolvedValueOnce(http(job, 202));
    expect(await requestJobComparison('job')).toEqual({ ok: true, data: job });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await getLatestAnalysis()).toEqual({ ok: true, data: null });
  });
  it('normalizes invalid successful responses without feature-specific error handling', async () => {
    fetchMock.mockImplementation(async () => http({}, 200));
    expect(await startAnalysis()).toEqual(await requestJobComparison('job'));
    expect(await startAnalysis()).toMatchObject({
      ok: false,
      retryable: false,
      errorCode: 'INVALID_AI_RESPONSE',
    });
  });
  it('rethrows login redirects rather than turning them into service failures', async () => {
    const login = Object.assign(new Error('Synthetic redirect'), {
      digest: 'NEXT_REDIRECT;replace;/login;307;',
    });
    vi.mocked(redirect).mockImplementation(() => {
      throw login;
    });
    fetchMock.mockImplementation(async () => http({}, 401));
    await expect(startAnalysis()).rejects.toBe(login);
    await expect(requestJobComparison('job')).rejects.toBe(login);
  });
  it('supports future AI requests with only request options and a success decoder', async () => {
    fetchMock.mockResolvedValueOnce(http({ text: 'synthetic result' }, 200));
    expect(
      await aiApiFetch(
        '/future-ai-request',
        { method: 'POST', body: '{}' },
        (value) => (value as { text: string }).text
      )
    ).toEqual({ ok: true, data: 'synthetic result' });
  });
  it('uses the same failure guard for client-to-server action transport errors', async () => {
    const failure = await runAiAction(async () => {
      throw new TypeError('Synthetic action transport failure');
    });
    fetchMock.mockRejectedValueOnce(new TypeError('Synthetic backend transport failure'));
    expect(await startAnalysis()).toEqual(failure);
  });
});
