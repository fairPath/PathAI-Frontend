# End-to-end tests (Playwright)

Browser tests of the profile page's Analysis panel. Next runs for real; **Spring is a stub**
(`support/stub-spring.mjs`). Not a required PR check.

## Run

```bash
npm ci
npx playwright install chromium   # once, about 100 MB
npm run test:e2e
npx playwright show-report        # after a run: traces and screenshots of failures
```

`npm run test:e2e` starts the stub on `:4010` and a dev server on `:3100` (built into
`.next-e2e`, so it never fights your own `npm run dev`). Nothing else needs to be running: no
Spring, no database, no AI service, no S3. Debug a single test with
`npx playwright test --ui` or `npx playwright test -g "can be retried" --headed`.

If port 3100 or 4010 is taken, the run fails on purpose. It never reuses a server it did not start,
because a leftover dev server would be talking to a real Spring.

## How it works

```text
Playwright ─▶ Chromium ─▶ Next (localhost:3100) ─server actions─▶ stub Spring (127.0.0.1:4010)
      └──────── test sets what the stub answers, then reads back what the app called ────────┘
```

Next calls Spring from the server, so the browser cannot be intercepted (`page.route` would
not see these calls). The stub is a real HTTP server, and each test sets its answers through
`stub.set(...)`.

## How to tell it is testing properly

1. **The guard test.** `talks to the stub Spring with the session token` fails if the app is not
   talking to the stub, so a green run cannot mean "it hit something else".
2. **Break the app on purpose.** A suite that cannot fail proves nothing. Make one of these edits,
   run `npm run test:e2e`, expect the named tests to fail, then `git checkout` the file:

   | Edit                                                                    | Should fail                                                 |
   | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
   | `AnalysisPanel.tsx`: change `{failure.canRetry && (` to `{true && (`    | both "cannot be retried" tests                              |
   | `AnalysisPanel.tsx`: change `onClick={onRetry}` to `onClick={() => {}}` | "can be retried offers Retry"                               |
   | `action.ts`: make `startAnalysis` return `error.message`                | both start-rejection tests (the raw body shows on the page) |

3. **Read a failure.** Each failure keeps a screenshot and a trace in `test-results/`.

## Limits

- The stub's JSON is written by hand from Spring's `AnalysisStatusDTO` and error envelope. If Spring
  changes a field, this suite will not notice: Spring's own WireMock tests pin its side and the
  Vitest tests pin the copy, but nothing compares the two.
- Not covered: the S3 upload, login, and anything that needs a real Spring.
- Polling uses the real 3 s interval, so the two tests that poll take about 7 s each.

## Adding a test

Set the stub, open `/dashboard/profile`, assert. Use `panelAlert(page)` for the panel's message,
not `getByRole('alert')`: Next renders an empty `role="alert"` route announcer, so the bare locator
can match two elements.
