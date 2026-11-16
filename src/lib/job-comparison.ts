import type { Job } from '@/types/Job';

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
