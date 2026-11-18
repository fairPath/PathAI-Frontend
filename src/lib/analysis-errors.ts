// Compatibility/display helpers. Decoding, messages and retry derivation live in ai-errors;
// Analysis only supplies its own fallbacks for codes with no shared copy.
import { aiErrorMessage, aiRetryable, decodeAiErrorBody } from './ai-errors';

const GENERIC_FAILURE = "Analysis didn't finish.";
const START_FAILURE = "Couldn't start the analysis. Please try again.";

export type FailureView = { message: string; canRetry: boolean };

export function describeFailure(errorCode: unknown, retryable: unknown): FailureView {
  return {
    message: aiErrorMessage(errorCode, null, undefined, GENERIC_FAILURE),
    canRetry: aiRetryable(retryable),
  };
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
  return aiErrorMessage(errorCode, retryAt, format, START_FAILURE);
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
