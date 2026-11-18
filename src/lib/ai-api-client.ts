/** Server-side AI request wrapper. Features supply only the request and success decoder. */
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { serverApiFetch } from '@/lib/server-api-client';
import { aiFailure, type AiRequestResult } from '@/lib/ai-errors';
import { runAiAction } from '@/lib/ai-request';

export function aiApiFetch<T>(
  path: string,
  options: Omit<RequestInit, 'headers'>,
  decodeSuccess: (value: unknown) => T
): Promise<AiRequestResult<T>> {
  return runAiAction(async () => {
    const value = await serverApiFetch<unknown>(path, options);
    try {
      return { ok: true, data: decodeSuccess(value) };
    } catch (error: unknown) {
      if (isRedirectError(error)) throw error;
      return aiFailure('INVALID_AI_RESPONSE', false);
    }
  });
}
