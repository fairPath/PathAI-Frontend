# Saved-job match checks

## Save and compare

Saving a job only persists its metadata and full description through `POST /saved-jobs/prepare`. A new job has `comparisonStatus=NOT_REQUESTED`. Saving never copies a resume or calls AI.

In the Saved Jobs tab only, the upper-right control in a saved job's details is **Check match**. After failure it becomes **Retry match**; after success it becomes **Check match again**. Saving/removing jobs remains available through the list's star. Search results retain a Save/Remove job star, including for jobs already saved; comparison buttons are not shown on Search.

Clicking the match button calls the Next.js server action, which sends only `{ jobId }` to `POST /saved-jobs/compare`. Spring derives the owner from the JWT and looks up that owner's saved job and active resume. It returns 202 with the saved-job DTO after atomically setting `PENDING` and assigning a new comparison request ID. Duplicate clicks while pending reuse that request.

## Latest active resume

The existing `resume` table has one row per `user_id`. Each worker claim resolves its current ACTIVE row and reads `s3_key`, `id`, and `updated_at`. The AI service downloads that live S3 object, extracts and redacts text, then compares it against the complete supplied job description.

Uploads reuse the resume row and live key, so the identifier alone is insufficient to detect replacement. Before storing success, Spring verifies the active resume ID, update timestamp, and S3 key still match the claimed version. A changed resume discards the result and follows bounded retries using the latest active version. Completed results record `resumeId`, `comparisonResumeUpdatedAt`, and `comparisonCompletedAt`.

Resume snapshots and their cleanup code have been removed. Both services must use the same resume bucket. Upload currently checks S3 existence and nonzero size; comparison still defensively handles missing or unreadable files.

A later upload does not automatically recompare completed jobs. The user requests another check explicitly.

## Polling and worker scheduling

The browser polls only saved jobs in `PENDING`, in one authenticated batch to `GET /api/saved-jobs/status?jobId=...`. Next.js forwards to Spring's user-scoped status endpoint. Polling starts two seconds after the pending state appears, waits two seconds between successful requests, and backs off 4/8/16/30 seconds on errors. The hook stops tracking a job when it becomes terminal or is unsaved; navigation aborts requests.

The browser has no overall polling-duration cap. Backend recovery normally moves work to a terminal state; an unavailable backend can keep the browser retrying.

The durable queue lives in `saved_jobs`. A dedicated one-thread `comparisonScheduler` handles synchronous comparison requests, separately from the default `taskScheduler` reserved for maintenance. One comparison runs at a time per instance. Claims use `FOR UPDATE SKIP LOCKED` and a 180-second lease. Multiple instances can claim safely. Result/failure updates require the saved-row ID, request ID, current PENDING status, and unexpired lease token; deleted or superseded jobs cannot be restored by late results.

## Errors and retry behavior

Phase 2 comparisons follow the Analysis convention: a `correlation_id` (the comparison request ID), the error envelope `{ correlation_id, error_code, retryable }`, stored error codes, the shared `aiServiceRestClient`, and `store=False` on model requests. AI success echoes the correlation ID; a mismatched response is rejected.

Frontend AI actions use `aiApiFetch` (`src/lib/ai-api-client.ts`), supplying only request options and a success decoder. Both Analysis and comparison share `ai-errors.ts` for envelope validation, error messages and retryability, and `runAiAction` for transport failures, including browser-to-server action failures. Valid backend boolean flags are authoritative. Malformed error envelopes fall back to retryable only for HTTP 408/429/502/503/504; network failures are retryable. Invalid successful responses are non-retryable. Missing or malformed stored flags use the same retryable fallback in both features. User-session redirects are preserved. These helpers do not automatically retry requests or change the existing feature recovery lifetimes.

The saved-job DTO includes `comparisonErrorCode` and `comparisonRetryable`. Safe fixed messages explain errors under the match button; raw upstream bodies are never rendered.

- Connection failures, timeouts, 408/429/502/503/504 responses are eligible for bounded retries. A typed non-retriable error overrides an otherwise transient HTTP status (for example provider configuration errors returned as 502).
- Other 4xx responses and unexpected internal/protocol failures are terminal. Validation errors and unreadable files are non-retriable.
- Automatic retries wait 10 and 20 seconds (or longer when Retry-After requires it), with at most three attempts. Exhaustion stores FAILED; a transient failure still permits a manual retry.
- A non-retriable failure observed during this page session greys out the button. Refreshing the page permits a fresh deliberate attempt, with the prior explanation retained. This is a UI lock, not a permanent server ban.
- A missing/expired user session (Spring 401) redirects to login. AI-service 401/403 is an internal configuration problem and never redirects the user.

Unsaving deletes the saved row and its pending work; it never deletes the active resume.

## Configuration and rollout

Frontend needs server-side `SPRING_BASE_URL`. Spring needs `FAIRPATH_AI_SERVICE_URL`, `FAIRPATH_AI_INTERNAL_TOKEN`, and its existing database/JWT/AWS settings. The AI service also requires explicit OPENAI_MODEL, OPENAI_BASE_URL and OPENAI_API_KEY at startup; OPENAI_TIMEOUT_SECONDS defaults to 90, and hidden SDK retries are disabled. The token must match AI `INTERNAL_TOKEN`; AI `AWS_BUCKET_NAME` must match the active resume bucket.

Worker settings under `fairpath.comparison-worker` configure enablement, poll delay (1000 ms), initial delay (5000 ms), maximum attempts (3), lease (180 seconds), and retry interval (10 seconds).

Deploy all three changes together: explicit Compare and the correlated AI contract are coordinated API changes. The owner resets/recreates the database schema for the coordinated contract. There are no migration scripts or agent writes to the shared database.

## Validation

Frontend: Node behavior tests, TypeScript, ESLint, and Prettier. Backend: REST tests with WireMock and disposable Testcontainers Postgres, plus queue tests for lease recovery, concurrent claims, typed terminal failures and resume-version fencing. AI service: pytest with synthetic PDFs, fake S3 and a fake model; no real provider or S3 calls.
