import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { requestAccountDeletion } from './actions';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const deleteCookie = vi.fn();
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('SPRING_BASE_URL', 'https://spring.example.invalid');
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(cookies).mockResolvedValue({
    get: () => ({ name: 'authToken', value: 'synthetic-jwt' }),
    delete: deleteCookie,
  } as unknown as Awaited<ReturnType<typeof cookies>>);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('requestAccountDeletion', () => {
  it('clears the session and succeeds without a receipt when the account is unavailable', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { code: 'ACCOUNT_UNAVAILABLE', message: 'Account unavailable' },
        { status: 401 }
      )
    );

    await expect(requestAccountDeletion('synthetic-password')).resolves.toEqual({
      ok: true,
      data: { token: null },
    });
    expect(deleteCookie).toHaveBeenCalledWith('authToken');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('keeps the sign-in redirect for an expired session', async () => {
    const redirected = new Error('redirect');
    vi.mocked(redirect).mockImplementationOnce(() => {
      throw redirected;
    });
    fetchMock.mockResolvedValueOnce(Response.json({ code: 'TOKEN_EXPIRED' }, { status: 401 }));

    await expect(requestAccountDeletion('synthetic-password')).rejects.toThrow(redirected);
    expect(redirect).toHaveBeenCalledWith('/login?reason=unauthorized');
    expect(deleteCookie).not.toHaveBeenCalled();
  });
});
