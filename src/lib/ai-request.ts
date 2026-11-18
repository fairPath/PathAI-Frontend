/** Shared invocation guard, usable by server transports and browser server-action callers. */
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { aiFailure, ApiError, type AiRequestResult } from './ai-errors';

export async function runAiAction<T>(
  action: () => Promise<AiRequestResult<T>>
): Promise<AiRequestResult<T>> {
  try {
    return await action();
  } catch (error: unknown) {
    if (isRedirectError(error)) throw error;
    if (error instanceof ApiError)
      return aiFailure(error.errorCode, error.retryable, error.correlationId, error.retryAt);
    return error instanceof SyntaxError
      ? aiFailure('INVALID_AI_RESPONSE', false)
      : aiFailure('AI_UNAVAILABLE', true);
  }
}
