import { describe, expect, it } from 'vitest';

import {
  describeFailure,
  describeResumeChangeFailure,
  describeStartFailure,
  errorCodeFromBody,
  retryAtFromBody,
} from './analysis-errors';

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

  it('does not show start-only copy on a FAILED Analysis', () => {
    expect(describeFailure('RESUME_NOT_FOUND', true).message).toBe("Analysis didn't finish.");
  });

  it('is not fooled by object prototype names', () => {
    expect(describeFailure('constructor', true).message).toBe("Analysis didn't finish.");
    expect(describeFailure('toString', true).message).toBe("Analysis didn't finish.");
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

  it('does not show run-only copy for a rejected request', () => {
    expect(describeStartFailure('ANALYSIS_TIMED_OUT')).toBe(
      "Couldn't start the analysis. Please try again."
    );
  });

  it('falls back to the generic start message', () => {
    expect(describeStartFailure('SOMETHING_NEW')).toBe(
      "Couldn't start the analysis. Please try again."
    );
    expect(describeStartFailure(null)).toBe("Couldn't start the analysis. Please try again.");
  });
});

describe('describeStartFailure for the Analysis limits', () => {
  const format = (date: Date) => `formatted(${date.toISOString()})`;

  it('tells the user an Analysis is already running', () => {
    expect(describeStartFailure('ANALYSIS_IN_PROGRESS')).toMatch(/already running/);
  });

  it('names the time the Cooldown ends, formatted by the caller', () => {
    expect(describeStartFailure('COOLDOWN_ACTIVE', '2026-11-15T14:30:00Z', format)).toBe(
      'You can analyze again on formatted(2026-11-15T14:30:00.000Z).'
    );
  });

  it('still says to wait when the Cooldown has no usable time', () => {
    for (const retryAt of [null, undefined, '', 'not a date']) {
      expect(describeStartFailure('COOLDOWN_ACTIVE', retryAt, format)).toMatch(/try again later/i);
    }
  });

  it('ignores a time on a code that does not use one', () => {
    expect(
      describeStartFailure('ANALYSIS_IN_PROGRESS', '2026-11-15T14:30:00Z', format)
    ).not.toMatch(/formatted/);
  });
});

describe('describeResumeChangeFailure', () => {
  it('explains that replace and delete wait for a running Analysis', () => {
    expect(describeResumeChangeFailure('ANALYSIS_IN_PROGRESS')).toMatch(/analysis to finish/i);
  });

  it('has no copy for other codes, so the caller keeps its own message', () => {
    expect(describeResumeChangeFailure('SOMETHING_NEW')).toBeNull();
    expect(describeResumeChangeFailure(null)).toBeNull();
  });
});

describe('retryAtFromBody', () => {
  it('reads retry_at from an error envelope', () => {
    const body =
      '{"correlation_id":null,"error_code":"COOLDOWN_ACTIVE","retryable":true,"retry_at":"2026-11-15T14:30:00Z"}';

    expect(retryAtFromBody(body)).toBe('2026-11-15T14:30:00Z');
  });

  it.each([
    ['a null retry_at', '{"error_code":"ANALYSIS_IN_PROGRESS","retry_at":null}'],
    ['no retry_at', '{"error_code":"ANALYSIS_IN_PROGRESS"}'],
    ['a non-string retry_at', '{"retry_at":42}'],
    ['plain text', 'Internal Server Error'],
    ['empty', ''],
  ])('returns null for %s', (_label, body) => {
    expect(retryAtFromBody(body)).toBeNull();
  });

  it('returns null for a missing body', () => {
    expect(retryAtFromBody(null)).toBeNull();
    expect(retryAtFromBody(undefined)).toBeNull();
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
