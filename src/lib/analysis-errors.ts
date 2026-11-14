// Pure mapping from an Analysis error_code to what the user sees.
// Raw error bodies never reach the browser: everything shown comes from here.

export type FailureView = {
  message: string;
  // Whether to offer Retry. Comes from the server's `retryable`, not from the copy.
  canRetry: boolean;
};

const GENERIC_FAILURE = "Analysis didn't finish.";

// Codes on a FAILED Analysis: the run started and ended badly.
const RUN_FAILURE_COPY: Record<string, string> = {
  TEXT_NOT_EXTRACTABLE:
    "We couldn't find any text in this resume. It may be a scan or an image. Upload a text-based PDF and try again.",
  FILE_UNREADABLE: "We couldn't open this file. Upload a text-based PDF and try again.",
  ANALYSIS_TIMED_OUT: "Analysis didn't finish because it took too long.",
};

// Codes on a rejected Analyze request: no Analysis exists.
const START_FAILURE_COPY: Record<string, string> = {
  RESUME_NOT_FOUND: 'Upload a resume to analyze it.',
};

function copyFor(
  copy: Record<string, string>,
  errorCode: string | null | undefined,
  fallback: string
): string {
  return (errorCode && Object.hasOwn(copy, errorCode) && copy[errorCode]) || fallback;
}

/**
 * What to show for a FAILED Analysis. An unknown or missing code gets the
 * generic message, and a missing `retryable` (an older server) counts as
 * retryable: a Retry button on a permanent failure costs a click, a missing
 * one on a transient failure strands the user.
 */
export function describeFailure(
  errorCode: string | null | undefined,
  retryable: boolean | null | undefined
): FailureView {
  return {
    message: copyFor(RUN_FAILURE_COPY, errorCode, GENERIC_FAILURE),
    canRetry: retryable ?? true,
  };
}

const START_FAILURE = "Couldn't start the analysis. Please try again.";

/** Copy for a rejected Analyze request (the 404/4xx envelope Spring returns). */
export function describeStartFailure(errorCode: string | null | undefined): string {
  return copyFor(START_FAILURE_COPY, errorCode, START_FAILURE);
}

/**
 * Pulls `error_code` out of an error body without ever returning the body
 * itself. Anything that isn't a JSON envelope yields null.
 */
export function errorCodeFromBody(body: string | null | undefined): string | null {
  if (!body) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && 'error_code' in parsed) {
      const code = (parsed as { error_code: unknown }).error_code;
      return typeof code === 'string' && code.length > 0 ? code : null;
    }
  } catch {
    // Not JSON: no code.
  }
  return null;
}
