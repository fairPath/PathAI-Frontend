/**
 * Shared polling schedule for background AI work. Pure: no timers, no clock.
 * The caller passes `now`, so tests and callers control time.
 */
export type PollSchedule = {
  /** Delay before each successive poll; the last value repeats. */
  backoffMs: readonly number[];
  /** Elapsed time since the row's server `created_at` after which a "taking longer" message shows. */
  softMessageAfterMs: number;
  /** Elapsed time since the row's server `created_at` after which polling stops. */
  hardCapMs: number;
};

export type PollPhase = 'normal' | 'slow' | 'expired';

export type PollPlan = {
  phase: PollPhase;
  /** Wait before the next poll, or null once the hard cap has passed. */
  delayMs: number | null;
};

/**
 * Plans the next poll. Elapsed time runs from the server's `created_at`, not from
 * page open, so a reload does not reset the soft message or the hard cap.
 * `attempt` is the number of polls already made on this page; it drives the backoff only.
 *
 * `created_at` is a server clock and `now` is the browser's: skew shifts the
 * thresholds by the same amount. Negative elapsed (browser behind) clamps to 0,
 * and an unparseable `created_at` counts as 0 elapsed (never expires).
 */
export function nextPoll(
  createdAt: string,
  now: number,
  attempt: number,
  schedule: PollSchedule
): PollPlan {
  const created = Date.parse(createdAt);
  const elapsed = Number.isFinite(created) ? Math.max(0, now - created) : 0;
  if (elapsed >= schedule.hardCapMs) return { phase: 'expired', delayMs: null };
  const step = Math.min(Math.max(0, attempt), schedule.backoffMs.length - 1);
  return {
    phase: elapsed >= schedule.softMessageAfterMs ? 'slow' : 'normal',
    delayMs: schedule.backoffMs[step],
  };
}
