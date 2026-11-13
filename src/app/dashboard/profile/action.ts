'use server';

import { serverApiFetch } from '@/lib/server-api-client';
import { ActionResult } from '@/types/action-result';
import { ResumeAnalysis } from '@/types/ResumeAnalysis';
import { ResumePresignUrlResponse } from '@/types/ResumePresignUrlResponse';
import { User } from '@/types/User';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { isRedirectError } from 'next/dist/client/components/redirect-error';

type ResumeAnalysisResult = { ok: true; data: ResumeAnalysis } | { ok: false; error: string };

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

function getUserIdFromAuthToken(token: string): string {
  const payload = token.split('.')[1];
  if (!payload) {
    throw new Error('Your session token is invalid. Please sign in again.');
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: unknown;
    };
    if (typeof claims.sub !== 'string') {
      throw new Error('The session token does not contain a user ID.');
    }
    return claims.sub;
  } catch {
    throw new Error('Could not read the user ID from your session. Please sign in again.');
  }
}

function isResumeAnalysis(value: unknown): value is ResumeAnalysis {
  if (!value || typeof value !== 'object') return false;
  const analysis = value as Record<string, unknown>;
  return (
    typeof analysis.ats_parseability_score === 'number' &&
    typeof analysis.experience_years === 'number' &&
    Array.isArray(analysis.skills) &&
    analysis.skills.every((item) => typeof item === 'string') &&
    Array.isArray(analysis.formatting_issues) &&
    analysis.formatting_issues.every((item) => typeof item === 'string') &&
    Array.isArray(analysis.writing_issues) &&
    analysis.writing_issues.every(
      (item) =>
        !!item &&
        typeof item === 'object' &&
        typeof item.issue_type === 'string' &&
        typeof item.description === 'string' &&
        typeof item.suggestion === 'string'
    ) &&
    Array.isArray(analysis.suggestions) &&
    analysis.suggestions.every((item) => typeof item === 'string') &&
    typeof analysis.model === 'string'
  );
}

export async function analyzeResume(resumeId: string): Promise<ResumeAnalysisResult> {
  const token = (await cookies()).get('authToken')?.value;
  if (!token) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    const user = await serverApiFetch<User>('/users/me', { method: 'GET' });
    if (user.resumeId !== resumeId) {
      return { ok: false, error: 'This resume is not the active resume for your account.' };
    }
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not verify the uploaded resume.',
    };
  }

  const internalToken = process.env.FAIRPATH_AI_INTERNAL_TOKEN;
  if (!internalToken) {
    return { ok: false, error: 'Resume analysis is not configured on this server.' };
  }

  let userId: string;
  try {
    userId = getUserIdFromAuthToken(token);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not identify the signed-in user.',
    };
  }

  const baseUrl = (process.env.FAIRPATH_AI_SERVICE_URL || 'http://localhost:8000').replace(
    /\/+$/,
    ''
  );

  try {
    const response = await fetch(`${baseUrl}/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': internalToken,
      },
      body: JSON.stringify({
        analysis_id: resumeId,
        s3_key: `resumes/${userId}/active.pdf`,
        user_id: userId,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    const responseBody = await response.text();
    if (!response.ok) {
      let detail = responseBody;
      try {
        const errorBody = JSON.parse(responseBody) as {
          detail?: unknown;
          message?: unknown;
          error?: unknown;
        };
        const message = errorBody.detail ?? errorBody.message ?? errorBody.error;
        if (typeof message === 'string') detail = message;
      } catch {
        // Keep the raw response text for non-JSON service errors.
      }

      return {
        ok: false,
        error: `Resume analysis failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 400)}` : ''}`,
      };
    }

    let data: unknown;
    try {
      data = JSON.parse(responseBody);
    } catch {
      return { ok: false, error: 'The AI service returned invalid JSON.' };
    }

    if (!isResumeAnalysis(data)) {
      return { ok: false, error: 'The AI service returned an incomplete analysis.' };
    }

    return { ok: true, data };
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return { ok: false, error: 'Resume analysis timed out. Please try again.' };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not reach the AI service.',
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

export async function saveSkillsJson(resumeId: string, skillsJson: object): Promise<ActionResult> {
  try {
    await serverApiFetch<void>('/resumes/saveSkills', {
      method: 'POST',
      body: JSON.stringify({ resumeId, skillsJson }),
    });
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
