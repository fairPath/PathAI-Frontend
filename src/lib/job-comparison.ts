import type { Job } from '@/types/Job';

const ERROR_COPY: Record<string, string> = {
  RESUME_REQUIRED: 'Upload an active resume before checking your match.',
  RESUME_CHANGED: 'Your resume changed during the check. Try again with your latest resume.',
  RESUME_UNREADABLE: 'Your resume could not be read. Upload a text-based PDF.',
  RESUME_UNAVAILABLE: 'Your resume is unavailable. Upload it again.',
  JOB_NOT_FOUND: 'This job is no longer saved.',
  INVALID_COMPARISON_REQUEST:
    'This job or resume could not be compared. Refresh the page and try again.',
  AI_AUTHENTICATION_FAILED: 'Match checks are temporarily unavailable. Please try again later.',
  AI_CONFIGURATION_ERROR: 'Match checks are temporarily unavailable. Please try again later.',
  STORAGE_CONFIGURATION_ERROR: 'Match checks are temporarily unavailable. Please try again later.',
  UPSTREAM_RATE_LIMITED: 'Match checks are busy. Please try again shortly.',
  AI_UNAVAILABLE: 'The match service could not be reached. Please try again.',
  AI_TIMED_OUT: 'The match check timed out. Please try again.',
  COMPARISON_TIMED_OUT: 'The match check timed out. Please try again.',
  COMPARISON_IN_PROGRESS: 'A match check is already in progress.',
  INVALID_AI_RESPONSE:
    'The match service could not complete this check. Refresh the page to try again.',
  INTERNAL_ERROR: 'The match check could not finish. Refresh the page to try again.',
};

export function comparisonErrorMessage(code: string | null | undefined): string {
  return (
    (code && Object.hasOwn(ERROR_COPY, code) && ERROR_COPY[code]) ||
    'The match check could not finish. Please try again.'
  );
}

export function comparisonButtonState(
  job: Job,
  hasResume: boolean,
  blocked: boolean,
  busy: boolean
) {
  const running = job.comparisonStatus === 'PENDING';
  return {
    label:
      running || busy
        ? 'Checking…'
        : job.comparisonStatus === 'FAILED'
          ? 'Retry match'
          : job.comparisonStatus === 'COMPLETED'
            ? 'Check match again'
            : 'Check match',
    disabled: running || busy || !hasResume || blocked,
  };
}
