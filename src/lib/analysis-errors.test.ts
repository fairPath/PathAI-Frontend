import { describe, expect, it } from 'vitest';

import { describeFailure, describeStartFailure, errorCodeFromBody } from './analysis-errors';

describe('describeFailure', () => {
  it('tells the user to upload a text-based PDF when text cannot be extracted', () => {
    const view = describeFailure('TEXT_NOT_EXTRACTABLE', false);

    expect(view.message).toMatch(/text-based PDF/);
    expect(view.canRetry).toBe(false);
  });

  it('tells the user to upload a text-based PDF when the file is unreadable', () => {
    const view = describeFailure('FILE_UNREADABLE', false);

    expect(view.message).toMatch(/text-based PDF/);
    expect(view.canRetry).toBe(false);
  });

  it('offers Retry for a timeout', () => {
    const view = describeFailure('ANALYSIS_TIMED_OUT', true);

    expect(view.message).toMatch(/took too long/);
    expect(view.canRetry).toBe(true);
  });

  it('uses the generic message with Retry for an internal error', () => {
    expect(describeFailure('INTERNAL_ERROR', true)).toEqual({
      message: "Analysis didn't finish.",
      canRetry: true,
    });
  });

  it('uses the generic message for an unknown code', () => {
    expect(describeFailure('SOMETHING_NEW', true).message).toBe("Analysis didn't finish.");
  });

  it('uses the generic message when there is no code', () => {
    expect(describeFailure(null, true).message).toBe("Analysis didn't finish.");
    expect(describeFailure(undefined, true).message).toBe("Analysis didn't finish.");
  });

  it('follows the server retryable flag, not the code', () => {
    expect(describeFailure('SOMETHING_NEW', false).canRetry).toBe(false);
    expect(describeFailure('TEXT_NOT_EXTRACTABLE', true).canRetry).toBe(true);
  });

  it('treats a missing retryable flag as retryable', () => {
    expect(describeFailure('INTERNAL_ERROR', null).canRetry).toBe(true);
    expect(describeFailure('INTERNAL_ERROR', undefined).canRetry).toBe(true);
  });
});

describe('describeStartFailure', () => {
  it('has its own copy for a missing resume', () => {
    expect(describeStartFailure('RESUME_NOT_FOUND')).toBe('Upload a resume to analyze it.');
  });

  it('falls back to the generic start message', () => {
    expect(describeStartFailure('SOMETHING_NEW')).toBe(
      "Couldn't start the analysis. Please try again."
    );
    expect(describeStartFailure(null)).toBe("Couldn't start the analysis. Please try again.");
  });
});

describe('errorCodeFromBody', () => {
  it('reads the code from an error envelope', () => {
    const body = '{"correlation_id":null,"error_code":"RESUME_NOT_FOUND","retryable":false}';

    expect(errorCodeFromBody(body)).toBe('RESUME_NOT_FOUND');
  });

  it.each([
    ['plain text', 'Internal Server Error'],
    ['json without a code', '{"detail":"nope"}'],
    ['a non-string code', '{"error_code":42}'],
    ['an empty code', '{"error_code":""}'],
    ['json null', 'null'],
    ['an empty body', ''],
  ])('returns null for %s', (_label, body) => {
    expect(errorCodeFromBody(body)).toBeNull();
  });

  it('returns null for a missing body', () => {
    expect(errorCodeFromBody(undefined)).toBeNull();
    expect(errorCodeFromBody(null)).toBeNull();
  });
});
