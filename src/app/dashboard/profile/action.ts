'use server';

import { serverApiFetch } from '@/lib/server-api-client';
import { ActionResult } from '@/types/action-result';
import { Analysis } from '@/types/ResumeAnalysis';
import { ResumePresignUrlResponse } from '@/types/ResumePresignUrlResponse';
import { revalidatePath } from 'next/cache';
import { isRedirectError } from 'next/dist/client/components/redirect-error';

export async function requestPresignUrl(
  formData: FormData
): Promise<{ ok: true; data: ResumePresignUrlResponse } | { ok: false; error: string }> {
  const file = formData.get('file');
  const fileName = file instanceof File ? file.name : null;

  if (!fileName) {
    return { ok: false, error: 'File is missing' };
  }

  try {
    const data = await serverApiFetch<ResumePresignUrlResponse>('/resumes/presign-url', {
      method: 'POST',
      body: JSON.stringify({ filename: fileName }),
    });
    return { ok: true, data };
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function confirmUpload(resumeId: string): Promise<ActionResult> {
  try {
    await serverApiFetch<void>('/resumes/confirm', {
      method: 'POST',
      body: JSON.stringify({ resumeId }),
    });

    revalidatePath('/dashboard/profile');
    return { ok: true };
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error('Error confirming resume upload:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function deleteResume(): Promise<ActionResult> {
  try {
    await serverApiFetch<void>('/resumes/delete', {
      method: 'DELETE',
    });

    revalidatePath('/dashboard/profile');
    return { ok: true };
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getResumeDownloadUrl(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  try {
    const url = await serverApiFetch<string>('/resumes/download', {
      method: 'GET',
    });

    if (!url) {
      return { ok: false, error: 'Failed to get download URL' };
    }

    return { ok: true, url };
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Analysis goes through Spring only; the browser never talks to the AI service.
// Raw error bodies never reach the user: failures map to fixed copy.

export async function startAnalysis(): Promise<ActionResult<Analysis>> {
  try {
    const data = await serverApiFetch<Analysis>('/resumes/analyze', { method: 'POST' });
    return { ok: true, data };
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error('Error starting resume analysis:', error);
    return { ok: false, error: "Couldn't start the analysis. Please try again." };
  }
}

/** The latest Analysis, or null when the resume has never been analyzed. */
export async function getLatestAnalysis(): Promise<ActionResult<Analysis | null>> {
  try {
    const data = await serverApiFetch<Analysis | undefined>('/resumes/analysis', {
      method: 'GET',
    });
    return { ok: true, data: data ?? null };
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error('Error reading resume analysis:', error);
    return { ok: false, error: "Couldn't load the analysis. Please refresh the page." };
  }
}
