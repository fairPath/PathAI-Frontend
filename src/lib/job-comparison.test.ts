import { expect, it } from 'vitest';
import { comparisonButtonState } from './job-comparison';
import type { Job } from '@/types/Job';
it.each(['NOT_REQUESTED', 'PENDING', 'COMPLETED', 'FAILED'] as const)('labels %s', (status) => {
  const state = comparisonButtonState({ comparisonStatus: status } as Job, true, false, false);
  expect(state.disabled).toBe(status === 'PENDING');
  expect(state.label).toBe(
    {
      NOT_REQUESTED: 'Check match',
      PENDING: 'Checking…',
      COMPLETED: 'Check match again',
      FAILED: 'Retry match',
    }[status]
  );
});
