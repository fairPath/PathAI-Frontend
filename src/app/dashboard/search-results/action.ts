'use server';

import { revalidatePath } from 'next/cache';
import { isRedirectError } from 'next/dist/client/components/redirect-error';

import { ApiError, serverApiFetch } from '@/lib/server-api-client';
import { Job } from '@/types/Job';
import { ActionResult } from '@/types/action-result';

export async function saveJob(job: Job): Promise<ActionResult<Job>> {
  try {
    const savedJob = await serverApiFetch<Job>('/saved-jobs/prepare', {
      method: 'POST',
      body: JSON.stringify(job),
    });
    if (!savedJob || savedJob.jobId !== job.jobId || savedJob.saved !== true) {
      throw new Error('The save service returned an invalid response. Please try again.');
    }
    revalidatePath('/dashboard/saved-jobs');
    return { ok: true, data: savedJob };
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to save job',
    };
  }
}

export async function deleteSavedJob(jobId: string): Promise<ActionResult> {
  try {
    await serverApiFetch<string>(`/saved-jobs/delete?jobId=${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
    });

    revalidatePath('/dashboard/saved-jobs');
    return { ok: true };
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to delete job',
    };
  }
}

// Only this explicit action requests inference; saving a job never does.
export async function requestJobComparison(
  jobId: string
): Promise<{ ok: true; data: Job } | { ok: false; errorCode: string; retryable: boolean }> {
  try {
    const job = await serverApiFetch<Job>('/saved-jobs/compare', {
      method: 'POST',
      body: JSON.stringify({ jobId }),
    });
    if (!job || job.jobId !== jobId || !job.saved || job.comparisonStatus !== 'PENDING')
      return { ok: false, errorCode: 'INVALID_AI_RESPONSE', retryable: false };
    return { ok: true, data: job };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      ok: false,
      errorCode:
        error instanceof ApiError ? (error.errorCode ?? 'INTERNAL_ERROR') : 'AI_UNAVAILABLE',
      retryable: error instanceof ApiError ? error.retryable : true,
    };
  }
}
