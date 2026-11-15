import { expect, it } from 'vitest';

import { comparisonButtonState, comparisonErrorMessage } from './job-comparison';
import type { Job } from '@/types/Job';

it.each(['constructor', 'toString', 'UNKNOWN', null])('uses safe fallback copy for %s', (code) => {
  expect(comparisonErrorMessage(code)).toBe('The AI request could not finish. Please try again.');
});

it('keeps internal authentication failures separate from user login', () => {
  expect(comparisonErrorMessage('AI_AUTHENTICATION_FAILED')).toMatch(/temporarily unavailable/);
  expect(comparisonErrorMessage('AI_AUTHENTICATION_FAILED')).not.toMatch(/login|sign in/i);
});

it('enables a deliberate retry after refresh clears the page block', () => {
  const job = { comparisonStatus: 'FAILED', comparisonRetryable: false } as Job;
  expect(comparisonButtonState(job, true, true, false)).toEqual({
    label: 'Retry match',
    disabled: true,
  });
  expect(comparisonButtonState(job, true, false, false)).toEqual({
    label: 'Retry match',
    disabled: false,
  });
});
