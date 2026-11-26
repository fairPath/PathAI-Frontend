import { describe, expect, it } from 'vitest';

import { nextPoll, type PollSchedule } from './polling';

const schedule: PollSchedule = {
  backoffMs: [3_000, 5_000, 10_000],
  softMessageAfterMs: 120_000,
  hardCapMs: 1_200_000,
};
const created = '2026-01-01T00:00:00Z';
const t0 = Date.parse(created);

describe('nextPoll', () => {
  it.each([
    [0, 3_000],
    [1, 5_000],
    [2, 10_000],
    [3, 10_000],
    [50, 10_000],
  ])('attempt %i waits %i ms', (attempt, delay) => {
    expect(nextPoll(created, t0 + 1_000, attempt, schedule)).toEqual({
      phase: 'normal',
      delayMs: delay,
    });
  });

  it('shows the soft message from softMessageAfter and keeps polling', () => {
    expect(nextPoll(created, t0 + 119_999, 5, schedule).phase).toBe('normal');
    expect(nextPoll(created, t0 + 120_000, 5, schedule)).toEqual({
      phase: 'slow',
      delayMs: 10_000,
    });
  });

  it('stops at the hard cap', () => {
    expect(nextPoll(created, t0 + 1_199_999, 0, schedule).phase).toBe('slow');
    expect(nextPoll(created, t0 + 1_200_000, 0, schedule)).toEqual({
      phase: 'expired',
      delayMs: null,
    });
  });

  it('measures from created_at, so a reload (attempt 0) does not reset the cap', () => {
    expect(nextPoll(created, t0 + 1_500_000, 0, schedule).phase).toBe('expired');
    expect(nextPoll(created, t0 + 300_000, 0, schedule).phase).toBe('slow');
  });

  it('treats a browser clock behind the server as zero elapsed', () => {
    expect(nextPoll(created, t0 - 60_000, 0, schedule)).toEqual({
      phase: 'normal',
      delayMs: 3_000,
    });
  });

  it('never expires on an unparseable created_at', () => {
    expect(nextPoll('not a date', t0, 0, schedule).phase).toBe('normal');
  });
});
