/** Shared, browser-safe AI failure decoding and copy. Raw response bodies never escape. */
export type AiFailure = {
  ok: false;
  error: string;
  errorCode: string;
  retryable: boolean;
  correlationId: string | null;
  retryAt: string | null;
};

export type AiRequestResult<T> = { ok: true; data: T } | AiFailure;

export type AiErrorEnvelope = {
  errorCode: string;
  retryable: boolean;
  correlationId: string | null;
  retryAt: string | null;
};

const GENERIC_FAILURE = 'The AI request could not finish. Please try again.';
const ERROR_COPY: Record<string, string> = {
  TEXT_NOT_EXTRACTABLE:
    "We couldn't find any text in this resume. It may be a scan or an image. Upload a text-based PDF and try again.",
  FILE_UNREADABLE: "We couldn't open this file. Upload a text-based PDF and try again.",
  RESUME_UNREADABLE: "We couldn't open this file. Upload a text-based PDF and try again.",
  RESUME_REQUIRED: 'Upload an active resume before trying again.',
  RESUME_NOT_FOUND: 'Upload an active resume before trying again.',
  RESUME_CHANGED: 'Your resume changed during the request. Try again with your latest resume.',
  RESUME_UNAVAILABLE: 'Your resume is unavailable. Upload it again.',
  JOB_NOT_FOUND: 'This job is no longer saved.',
  INVALID_COMPARISON_REQUEST:
    'This job or resume could not be compared. Refresh the page and try again.',
  AI_AUTHENTICATION_FAILED: 'AI requests are temporarily unavailable. Please try again later.',
  AI_CONFIGURATION_ERROR: 'AI requests are temporarily unavailable. Please try again later.',
  STORAGE_CONFIGURATION_ERROR: 'AI requests are temporarily unavailable. Please try again later.',
  UPSTREAM_RATE_LIMITED: 'AI requests are busy. Please try again shortly.',
  AI_UNAVAILABLE: 'The AI service could not be reached. Please try again.',
  AI_TIMED_OUT: 'The AI request timed out. Please try again.',
  ANALYSIS_TIMED_OUT: 'The AI request timed out. Please try again.',
  COMPARISON_TIMED_OUT: 'The AI request timed out. Please try again.',
  LLM_TIMEOUT: 'The AI request timed out. Please try again.',
  LLM_UNAVAILABLE: 'The AI service could not be reached. Please try again.',
  COMPARISON_IN_PROGRESS: 'A match check is already in progress.',
  ANALYSIS_IN_PROGRESS:
    'A resume analysis is already running. Wait for the analysis to finish before trying again.',
  COOLDOWN_ACTIVE: 'Please try again later.',
  INVALID_AI_RESPONSE: 'The AI service returned an invalid response. Please try again later.',
  INTERNAL_ERROR: GENERIC_FAILURE,
};

function validCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(value);
}

export function parseAiErrorEnvelope(value: unknown): AiErrorEnvelope | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const fields = value as Record<string, unknown>;
  if (
    !validCode(fields.error_code) ||
    typeof fields.retryable !== 'boolean' ||
    !(fields.correlation_id === null || typeof fields.correlation_id === 'string')
  )
    return null;
  return {
    errorCode: fields.error_code,
    retryable: fields.retryable,
    correlationId: fields.correlation_id,
    retryAt:
      typeof fields.retry_at === 'string' && Number.isFinite(Date.parse(fields.retry_at))
        ? fields.retry_at
        : null,
  };
}

export function decodeAiErrorBody(body: string | null | undefined): AiErrorEnvelope | null {
  if (!body) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    return parseAiErrorEnvelope(parsed);
  } catch {
    return null;
  }
}

export function aiErrorMessage(
  code: unknown,
  retryAt?: string | null,
  format: (date: Date) => string = (date) =>
    new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
): string {
  if (code === 'COOLDOWN_ACTIVE' && retryAt) {
    const date = new Date(retryAt);
    if (Number.isFinite(date.getTime())) return `You can try again on ${format(date)}.`;
  }
  return validCode(code) && Object.hasOwn(ERROR_COPY, code) ? ERROR_COPY[code] : GENERIC_FAILURE;
}

/** A validated backend boolean wins. Missing/malformed stored flags use the same fallback. */
export function aiRetryable(value: unknown, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function aiFailure(
  errorCode: string | null,
  retryable: boolean,
  correlationId: string | null = null,
  retryAt: string | null = null
): AiFailure {
  // Format retryAt in the browser, not the server's timezone.
  return {
    ok: false,
    error: aiErrorMessage(errorCode),
    errorCode: errorCode ?? 'INTERNAL_ERROR',
    retryable,
    correlationId,
    retryAt,
  };
}

export function aiHttpFailure(body: string, status: number): AiFailure {
  const envelope = decodeAiErrorBody(body);
  return envelope
    ? aiFailure(envelope.errorCode, envelope.retryable, envelope.correlationId, envelope.retryAt)
    : aiFailure('INTERNAL_ERROR', [408, 429, 502, 503, 504].includes(status));
}

/** Shared HTTP error carrier; only its normalized fields are returned by AI actions. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly errorCode: string | null,
    public readonly retryable: boolean,
    public readonly correlationId: string | null,
    public readonly retryAt: string | null = null,
    public readonly status: number | null = null
  ) {
    super(message);
  }
}
