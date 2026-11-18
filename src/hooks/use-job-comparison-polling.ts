'use client';

import { useEffect, useRef, useState } from 'react';
import { Job } from '@/types/Job';

/** Poll one batch at a time; stop after completion, unmount, or a save/remove operation. */
export function useJobComparisonPolling(
  jobs: Job[],
  onUpdate: (job: Job) => void,
  busyIds: Set<string>
) {
  const latest = useRef({ jobs, onUpdate });
  const [pollingError, setPollingError] = useState(false);
  useEffect(() => {
    latest.current = { jobs, onUpdate };
  }, [jobs, onUpdate]);
  const pendingKey = JSON.stringify(
    jobs
      .filter((job) => job.saved && job.comparisonStatus === 'PENDING' && !busyIds.has(job.jobId))
      .map((job) => [job.jobId, job.comparisonRequestId ?? null])
      .sort()
  );

  useEffect(() => {
    const pending: [string, string | null][] = JSON.parse(pendingKey);
    if (pending.length === 0) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let retryMs = 2000;

    const poll = async () => {
      try {
        const params = new URLSearchParams();
        pending.forEach(([jobId]) => params.append('jobId', jobId));
        const response = await fetch(`/api/saved-jobs/status?${params}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.redirected || response.status === 401) {
          window.location.assign('/login?reason=unauthorized');
          return;
        }
        if (!response.ok) throw new Error('Unable to refresh comparisons');
        const updates: Job[] = await response.json();
        if (!Array.isArray(updates)) throw new Error('Invalid comparison response');
        if (controller.signal.aborted) return;
        setPollingError(false);
        retryMs = 2000;
        for (const updated of updates) {
          const current = latest.current.jobs.find((job) => job.jobId === updated.jobId);
          // A response from before unsave/re-save must never restore the old job or score.
          if (
            current?.saved &&
            current.comparisonStatus === 'PENDING' &&
            (!current.comparisonRequestId ||
              current.comparisonRequestId === updated.comparisonRequestId) &&
            updated.comparisonStatus !== 'PENDING'
          ) {
            latest.current.onUpdate(updated);
          }
        }
      } catch {
        if (controller.signal.aborted) return;
        setPollingError(true);
        retryMs = Math.min(retryMs * 2, 30000);
      }
      if (!controller.signal.aborted) timer = setTimeout(() => void poll(), retryMs);
    };
    timer = setTimeout(() => void poll(), 2000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [pendingKey]);

  return JSON.parse(pendingKey).length > 0 && pollingError;
}
