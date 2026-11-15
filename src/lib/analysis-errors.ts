// Compatibility/display helpers. All decoding, messages and retry derivation live in ai-errors.
import { aiErrorMessage, aiRetryable, decodeAiErrorBody } from './ai-errors';

export type FailureView = { message: string; canRetry: boolean };

export function describeFailure(errorCode: unknown, retryable: unknown): FailureView {
  return { message: aiErrorMessage(errorCode), canRetry: aiRetryable(retryable) };
}

export function canStartAnotherAnalysis(
  analysis: { status: string; error_code: string | null; retryable: boolean | null } | null
): boolean {
  return !analysis || analysis.status !== 'FAILED' || aiRetryable(analysis.retryable);
}

export function describeStartFailure(
  errorCode: string | null | undefined,
  retryAt?: string | null,
  format?: (date: Date) => string
): string {
  return aiErrorMessage(errorCode, retryAt, format);
}

export function describeResumeChangeFailure(errorCode: string | null | undefined): string | null {
  return errorCode === 'ANALYSIS_IN_PROGRESS' ? aiErrorMessage(errorCode) : null;
}

export function retryAtFromBody(body: string | null | undefined): string | null {
  return decodeAiErrorBody(body)?.retryAt ?? null;
}

export function errorCodeFromBody(body: string | null | undefined): string | null {
  return decodeAiErrorBody(body)?.errorCode ?? null;
}
