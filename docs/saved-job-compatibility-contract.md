# Saved-job compatibility flow

## Responsibilities

- The browser calls Next.js, which forwards the signed-in user's token to Spring.
- Spring is the only service that reads and writes application database tables. Every saved-job read and mutation is scoped to the verified JWT user; the frontend and AI service have no database credentials.
- A worker inside Spring sends private resume snapshot keys and its internal token to the AI service. Neither is exposed to browser components.

## Saving and comparison

1. The star calls the Next.js `saveJob` action, which sends `POST /saved-jobs/prepare` to Spring.
2. Spring locks the user's row, enforces a maximum of 150 saved jobs, and creates or updates the unique `(user_id, job_id)` record. An active resume is copied to an immutable S3 snapshot. The snapshot is reused for an unchanged resume version.
3. Spring commits the saved job with `comparisonStatus=PENDING` and durable claim/retry fields. Next.js returns the saved-job DTO immediately after preparation; it does not wait for AI inference. Without an active resume, status is `NOT_REQUESTED` and comparison can be requested after uploading one.
4. Spring's scheduled worker atomically claims pending rows with `FOR UPDATE SKIP LOCKED`. It releases the database connection before sending `POST /job-comparison` to the AI service, with a 120-second request timeout and 180-second claim lease.
5. AI downloads the snapshot, extracts PDF text, redacts PII, and uses the shared LLM gateway to return structured comparison fields. The worker persists the result only if the saved-row ID, comparison request ID, and lease token still match. Stale results cannot overwrite a newer comparison or recreate an unsaved job.
6. The UI polls `GET /api/saved-jobs/status?jobId=...` for pending jobs in batches every two seconds. Next.js forwards this to the user-scoped Spring status endpoint. Completed scores and details update automatically; transient polling failures back off.

Worker failures retry after 10 and 20 seconds, up to three attempts. Interrupted claims become eligible after lease expiry, including after restart. Exhausted work becomes `FAILED`; the details panel offers manual retry with a new request ID. Saving an unchanged pending or completed comparison does not start duplicate work. Unsaving deletes the database row and attempts S3 snapshot cleanup after commit.

The comparison contains match score, matched/missing skills, relevant experience, and other gaps. It does not include improvement suggestions. PDFs without extractable text return HTTP 422; OCR is not included.

## Descriptions and presentation

`job_description TEXT` stores the entire description received from the source. The API and worker use it unchanged as one string. Adzuna's public search API returns a snippet of up to 500 characters; preserving it does not recover omitted source text.

Desktop shows a job list and a scrollable details panel. Small screens expand details immediately below the selected card; tapping it again or selecting Hide details collapses the section. Saving, removing, comparison status, and scores stay synchronized across the list and selected details.

## Configuration and rollout

- Frontend: `SPRING_BASE_URL` is server-side. Existing resume analysis may also use `FAIRPATH_AI_SERVICE_URL` and `FAIRPATH_AI_INTERNAL_TOKEN`; never prefix secrets with `NEXT_PUBLIC_`.
- Backend: database, JWT, AWS settings, `FAIRPATH_AI_SERVICE_URL`, and `FAIRPATH_AI_INTERNAL_TOKEN`. The worker token must match AI `INTERNAL_TOKEN`; `COMPARISON_WORKER_ENABLED` defaults to true.
- AI: matching `INTERNAL_TOKEN`, S3 settings (`AWS_BUCKET_NAME` matching the backend snapshot bucket), and model-provider settings.

Hibernate uses `ddl-auto=update` to create/update the development schema, including queue fields and indexes. The development database has no historical entries to migrate.

Deploy the backend, AI service, and frontend together: preparation returns a saved-job DTO; the old browser-driven completion/failure endpoints have been removed.

## Validation

Run `node --test scripts/background-comparison.test.mjs`, TypeScript, ESLint, and Prettier checks in the frontend. Backend unit tests cover queue dispatch, save deduplication/retry, authorization scoping, and description preservation. PostgreSQL integration tests require an explicit disposable test database; see the backend README. AI endpoint tests use synthetic PDFs and dependency overrides without real S3 or model calls.
