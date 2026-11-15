import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-api-client', () => ({ serverApiFetch: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/dist/client/components/redirect-error', () => ({ isRedirectError: () => false }));

import { serverApiFetch } from '@/lib/server-api-client';

import { confirmUpload, deleteResume, requestPresignUrl } from './action';

// The body Spring sends while an Analysis runs; serverApiFetch throws it as the message.
const IN_PROGRESS = JSON.stringify({
  correlation_id: null,
  error_code: 'ANALYSIS_IN_PROGRESS',
  retryable: true,
  retry_at: null,
});

const mockedFetch = vi.mocked(serverApiFetch);

beforeEach(() => {
  mockedFetch.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('replacing or deleting the Resume while an Analysis runs', () => {
  it('shows fixed copy, not the JSON body, when confirm is rejected', async () => {
    mockedFetch.mockRejectedValue(new Error(IN_PROGRESS));

    const result = await confirmUpload('resume-id');

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/analysis to finish/i) });
  });

  it('shows the same copy when delete is rejected', async () => {
    mockedFetch.mockRejectedValue(new Error(IN_PROGRESS));

    expect(await deleteResume()).toEqual({
      ok: false,
      error: expect.stringMatching(/analysis to finish/i),
    });
  });

  it('shows the same copy when presign is rejected', async () => {
    mockedFetch.mockRejectedValue(new Error(IN_PROGRESS));
    const form = new FormData();
    form.set('file', new File(['x'], 'resume.pdf'));

    expect(await requestPresignUrl(form)).toEqual({
      ok: false,
      error: expect.stringMatching(/analysis to finish/i),
    });
  });

  it('keeps the original message for any other confirm failure', async () => {
    mockedFetch.mockRejectedValue(new Error('Uploaded resume file is empty'));

    expect(await confirmUpload('resume-id')).toEqual({
      ok: false,
      error: 'Uploaded resume file is empty',
    });
  });
});
