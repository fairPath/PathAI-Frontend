import { describe, expect, it } from 'vitest';

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

// Guard: job comparison shares its error copy map with Analysis. These are
// the codes the comparison backend can emit; if a change to the shared map
// alters what comparison users read, or leaks Analysis wording into it, this fails.
const COMPARISON_COPY: Record<string, string> = {
  AI_AUTHENTICATION_FAILED: 'AI requests are temporarily unavailable. Please try again later.',
  AI_CONFIGURATION_ERROR: 'AI requests are temporarily unavailable. Please try again later.',
  STORAGE_CONFIGURATION_ERROR: 'AI requests are temporarily unavailable. Please try again later.',
  UPSTREAM_RATE_LIMITED: 'AI requests are busy. Please try again shortly.',
  AI_UNAVAILABLE: 'The AI service could not be reached. Please try again.',
  AI_TIMED_OUT: 'The AI request timed out. Please try again.',
  COMPARISON_TIMED_OUT: 'The AI request timed out. Please try again.',
  INVALID_AI_RESPONSE: 'The AI service returned an invalid response. Please try again later.',
  INTERNAL_ERROR: 'The AI request could not finish. Please try again.',
  RESUME_UNREADABLE: "We couldn't open this file. Upload a text-based PDF and try again.",
  RESUME_REQUIRED: 'Upload an active resume before trying again.',
  RESUME_UNAVAILABLE: 'Your resume is unavailable. Upload it again.',
  RESUME_CHANGED: 'Your resume changed during the request. Try again with your latest resume.',
  JOB_NOT_FOUND: 'This job is no longer saved.',
  INVALID_COMPARISON_REQUEST:
    'This job or resume could not be compared. Refresh the page and try again.',
  COMPARISON_IN_PROGRESS: 'A match check is already in progress.',
};

describe('comparison error copy is not changed by Analysis wording', () => {
  it.each(Object.entries(COMPARISON_COPY))('%s keeps its comparison wording', (code, message) => {
    expect(comparisonErrorMessage(code)).toBe(message);
  });

  it.each(Object.keys(COMPARISON_COPY))('%s never uses Analysis wording', (code) => {
    expect(comparisonErrorMessage(code)).not.toMatch(/analy[sz]/i);
  });
});
