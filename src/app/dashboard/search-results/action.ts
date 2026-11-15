'use server';

import { revalidatePath } from 'next/cache';
import { isRedirectError } from 'next/dist/client/components/redirect-error';

import { serverApiFetch } from '@/lib/server-api-client';
import { Job } from '@/types/Job';
import { aiApiFetch } from '@/lib/ai-api-client';
import type { AiRequestResult } from '@/lib/ai-errors';
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
export async function requestJobComparison(jobId: string): Promise<AiRequestResult<Job>> {
  return aiApiFetch(
    '/saved-jobs/compare',
    {
      method: 'POST',
      body: JSON.stringify({ jobId }),
    },
    (value) => {
      const job = value as Job | undefined;
      if (!job || job.jobId !== jobId || job.saved !== true || job.comparisonStatus !== 'PENDING')
        throw new Error('Invalid comparison response');
      return job;
    }
  );
}
