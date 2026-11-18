'use server';

import { describeResumeChangeFailure, errorCodeFromBody } from '@/lib/analysis-errors';
import { serverApiFetch } from '@/lib/server-api-client';
import { aiApiFetch } from '@/lib/ai-api-client';
import type { AiRequestResult } from '@/lib/ai-errors';
import { parseAnalysisResponse } from '@/lib/analysis';
import { ActionResult } from '@/types/action-result';
import { Analysis, StartAnalysisResult } from '@/types/ResumeAnalysis';
import { ResumePresignUrlResponse } from '@/types/ResumePresignUrlResponse';
import { revalidatePath } from 'next/cache';
import { isRedirectError } from 'next/dist/client/components/redirect-error';

// Replacing or deleting the Resume is rejected while an Analysis runs. Spring's
// body is JSON: show fixed copy for that code, and keep the old message otherwise.
function resumeChangeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return describeResumeChangeFailure(errorCodeFromBody(message)) ?? message;
}

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
    return { ok: false, error: resumeChangeError(error) };
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
    return { ok: false, error: resumeChangeError(error) };
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
    return { ok: false, error: resumeChangeError(error) };
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

export async function startAnalysis(): Promise<StartAnalysisResult> {
  return aiApiFetch('/resumes/analyze', { method: 'POST' }, parseAnalysisResponse);
}

/** The latest Analysis, or null when the resume has never been analyzed. */
export async function getLatestAnalysis(): Promise<AiRequestResult<Analysis | null>> {
  return aiApiFetch('/resumes/analysis', { method: 'GET', cache: 'no-store' }, (value) =>
    value == null ? null : parseAnalysisResponse(value)
  );
}
