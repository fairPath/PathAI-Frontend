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
  ANALYSIS_IN_PROGRESS: 'An analysis is already running. Wait for it to finish, then try again.',
};

// A rejected replace or delete of the Resume: no Analysis may be running.
const RESUME_CHANGE_FAILURE_COPY: Record<string, string> = {
  ANALYSIS_IN_PROGRESS:
    'Wait for your resume analysis to finish before replacing or deleting your resume.',
};

function formatLocal(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    date
  );
}

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

/**
 * Copy for a rejected Analyze request (the 4xx envelope Spring returns).
 * `retryAt` is the UTC time the Cooldown ends. It is formatted here, by
 * `format` (the browser's locale and timezone by default), so call this in
 * the browser: a server action would format it in the server's timezone.
 */
export function describeStartFailure(
  errorCode: string | null | undefined,
  retryAt?: string | null,
  format: (date: Date) => string = formatLocal
): string {
  if (errorCode === 'COOLDOWN_ACTIVE') {
    const date = retryAt ? new Date(retryAt) : null;
    return date && !Number.isNaN(date.getTime())
      ? `You can analyze again on ${format(date)}.`
      : 'You analyzed recently. Please try again later.';
  }
  return copyFor(START_FAILURE_COPY, errorCode, START_FAILURE);
}

/** Copy for a replace or delete of the Resume rejected while an Analysis runs, else null. */
export function describeResumeChangeFailure(errorCode: string | null | undefined): string | null {
  return (
    (errorCode &&
      Object.hasOwn(RESUME_CHANGE_FAILURE_COPY, errorCode) &&
      RESUME_CHANGE_FAILURE_COPY[errorCode]) ||
    null
  );
}

/** Pulls `retry_at` (a UTC timestamp string) out of an error body, or null. */
export function retryAtFromBody(body: string | null | undefined): string | null {
  if (!body) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && 'retry_at' in parsed) {
      const retryAt = (parsed as { retry_at: unknown }).retry_at;
      return typeof retryAt === 'string' && retryAt.length > 0 ? retryAt : null;
    }
  } catch {
    // Not JSON: no time.
  }
  return null;
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
