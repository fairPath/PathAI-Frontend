# Saved-job match checks

## Save and compare

Saving a job only persists its metadata and full description through `POST /saved-jobs/prepare`. A new job has `comparisonStatus=NOT_REQUESTED`. Saving never copies a resume or calls AI.

In the Saved Jobs tab only, the upper-right control in a saved job's details is **Check match**. After failure it becomes **Retry match**; after success it becomes **Check match again**. Saving/removing jobs remains available through the list's star. Search results retain a Save/Remove job star, including for jobs already saved; comparison buttons are not shown on Search.

Clicking the match button calls the Next.js server action, which sends only `{ jobId }` to `POST /saved-jobs/compare`. Spring derives the owner from the JWT and looks up that owner's saved job and active resume. It returns 202 with the saved-job DTO after atomically setting `PENDING` and assigning a new comparison request ID. Duplicate clicks while pending reuse that request.

## Latest active resume

The existing `resume` table has one row per `user_id`. Each worker claim resolves its current ACTIVE row and reads `s3_key`, `id`, and `updated_at`. The AI service downloads that live S3 object, extracts and redacts text, then compares it against the complete supplied job description.

Uploads reuse the resume row and live key, so the identifier alone is insufficient to detect replacement. Before storing success, Spring verifies the active resume ID, update timestamp, and S3 key still match the claimed version. A changed resume discards the result and permits a fresh manual check using the latest active version. Completed results record `resumeId`, `comparisonResumeUpdatedAt`, and `comparisonCompletedAt`.

Resume snapshots and their cleanup code have been removed. Both services must use the same resume bucket. Upload currently checks S3 existence and nonzero size; comparison still defensively handles missing or unreadable files.

A later upload does not automatically recompare completed jobs. The user requests another check explicitly.

## Polling and worker scheduling

The browser polls only saved jobs in `PENDING`, in one authenticated batch to `GET /api/saved-jobs/status?jobId=...`. Next.js forwards to Spring's user-scoped status endpoint. Polling starts two seconds after the pending state appears, waits two seconds between successful requests, and backs off 4/8/16/30 seconds on errors. The hook stops tracking a job when it becomes terminal or is unsaved; navigation aborts requests.

The browser has no overall polling-duration cap. Backend recovery normally moves work to a terminal state; an unavailable backend can keep the browser retrying.

Backend execution shares Analysis's original after-commit `@Async` method through `AiRequestExecution`, using Spring's default task pool (8 core threads by default). Comparison has no separate inference scheduler. Each task claims its own request generation and resolves the latest ACTIVE resume before inference; request, lease and version guards reject stale updates. The lease defaults to 300 seconds to cover two 120-second calls plus the five-second retry wait. Like Analysis on current main, interrupted events are not automatically replayed after restart; recovery remains follow-up work.

## Errors and retry behavior

Phase 2 comparisons follow the Analysis convention: a `correlation_id` (the comparison request ID), the error envelope `{ correlation_id, error_code, retryable }`, stored error codes, the shared `aiServiceRestClient`, and `store=False` on model requests. AI success echoes the correlation ID; a mismatched response is rejected.

Frontend AI actions use `aiApiFetch` (`src/lib/ai-api-client.ts`), supplying only request options and a success decoder. Both Analysis and comparison share `ai-errors.ts` for envelope validation, error messages and retryability, and `runAiAction` for transport failures, including browser-to-server action failures. Valid backend boolean flags are authoritative. Malformed error envelopes fall back to retryable only for HTTP 408/429/502/503/504; network failures are retryable. Invalid successful responses are non-retryable. Missing or malformed stored flags use the same retryable fallback in both features. User-session redirects are preserved. These helpers do not automatically retry requests or change the existing feature recovery lifetimes.

The saved-job DTO includes `comparisonErrorCode` and `comparisonRetryable`. Safe fixed messages explain errors under the match button; raw upstream bodies are never rendered.

- Both features use Analysis's original automatic retry: once after five seconds for connection refusal or a 503 without a valid envelope. Timeouts, typed provider failures, other statuses and result-storage failures do not automatically replay inference.
- Stored AI-failure retryability follows the same code rule: only `TEXT_NOT_EXTRACTABLE` and `FILE_UNREADABLE` are permanent. Feature preconditions such as a missing active resume remain separate explicit failures.
- A non-retryable comparison failure observed during this page session greys out the button. Refresh permits another deliberate attempt. Frontend status polling and recovery lifetimes are unchanged.
- A missing/expired user session redirects to login. Internal AI-token failures follow Analysis's INTERNAL_ERROR/manual-retry behavior and never redirect the user.
- Valid `Retry-After` metadata is still safely forwarded/decoded, but the restored Analysis policy retains its fixed delay and does not automatically retry typed rate limits.

Unsaving deletes the saved row and its pending work; it never deletes the active resume.

## Configuration and rollout

Frontend needs server-side `SPRING_BASE_URL`. Spring needs `FAIRPATH_AI_SERVICE_URL`, `FAIRPATH_AI_INTERNAL_TOKEN`, and its existing database/JWT/AWS settings. The AI service also requires explicit OPENAI_MODEL, OPENAI_BASE_URL and OPENAI_API_KEY at startup; OPENAI_TIMEOUT_SECONDS defaults to 90, and hidden SDK retries are disabled. The token must match AI `INTERNAL_TOKEN`; AI `AWS_BUCKET_NAME` must match the active resume bucket.

`fairpath.comparison-worker` controls enablement and the 300-second lease. Shared retry delay is `fairpath.ai-service.retry-delay` (five seconds). There is no comparison-specific attempt count, retry backoff or scheduler.

Deploy all three changes together: explicit Compare and the correlated AI contract are coordinated API changes. The owner resets/recreates the database schema for the coordinated contract. There are no migration scripts or agent writes to the shared database.

## Validation

Frontend: Node behavior tests, TypeScript, ESLint, and Prettier. Backend: REST tests with WireMock and disposable Testcontainers Postgres, plus queue tests for lease recovery, concurrent claims, typed terminal failures and resume-version fencing. AI service: pytest with synthetic PDFs, fake S3 and a fake model; no real provider or S3 calls.
