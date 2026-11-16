import { describe, expect, it } from 'vitest';
import { aiErrorMessage, aiHttpFailure, aiRetryable, parseAiErrorEnvelope } from './ai-errors';

const envelope = { correlation_id: null, error_code: 'RESUME_REQUIRED', retryable: false };

describe('shared AI decoding', () => {
  it.each([
    null,
    [],
    0,
    'false',
    {},
    { ...envelope, retryable: 'false' },
    { ...envelope, retryable: 0 },
    { ...envelope, error_code: {} },
    { ...envelope, correlation_id: 42 },
  ])('rejects malformed envelope %#', (value) => {
    expect(parseAiErrorEnvelope(value)).toBeNull();
    expect(aiHttpFailure(JSON.stringify(value), 422).retryable).toBe(false);
  });
  it.each([408, 429, 502, 503, 504])(
    'uses transient HTTP %s when the envelope is invalid',
    (status) => {
      expect(aiHttpFailure('null', status).retryable).toBe(true);
    }
  );
  it.each([400, 403, 404, 409, 422, 500])(
    'uses permanent HTTP %s when the envelope is invalid',
    (status) => {
      expect(aiHttpFailure('not JSON', status).retryable).toBe(false);
    }
  );
  it('trusts a validated backend retry flag rather than replacing it with the status', () => {
    expect(aiHttpFailure(JSON.stringify({ ...envelope, retryable: true }), 409).retryable).toBe(
      true
    );
    expect(aiHttpFailure(JSON.stringify(envelope), 503).retryable).toBe(false);
  });
  it('retains a valid cooldown timestamp for formatting in the browser', () => {
    const failure = aiHttpFailure(
      JSON.stringify({
        ...envelope,
        error_code: 'COOLDOWN_ACTIVE',
        retryable: true,
        retry_at: '2026-11-15T14:30:00Z',
      }),
      429
    );
    expect(failure.retryAt).toBe('2026-11-15T14:30:00Z');
    expect(aiErrorMessage(failure.errorCode, failure.retryAt, (date) => date.toISOString())).toBe(
      'You can analyze again on 2026-11-15T14:30:00.000Z.'
    );
  });
  it('does not expose raw bodies or unknown code text', () => {
    const failure = aiHttpFailure('Traceback: synthetic private content', 500);
    expect(JSON.stringify(failure)).not.toContain('private content');
    expect(aiErrorMessage('constructor')).toBe(aiErrorMessage(null));
    expect(aiErrorMessage('UNKNOWN_CODE')).toBe(aiErrorMessage(null));
  });
  it('validates stored flags with the same fallback in both features', () => {
    expect(aiRetryable(false)).toBe(false);
    expect(aiRetryable('false')).toBe(true);
    expect(aiRetryable(null)).toBe(true);
  });
});
