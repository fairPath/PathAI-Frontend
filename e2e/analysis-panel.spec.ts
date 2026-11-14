import { analysis, completed, expect, panelAlert, test } from './support/fixtures';

const TEXT_NOT_EXTRACTABLE_COPY =
  "We couldn't find any text in this resume. It may be a scan or an image. Upload a text-based PDF and try again.";

test.describe('Analysis panel', () => {
  test('talks to the stub Spring with the session token', async ({ page, stub }) => {
    await page.goto('/dashboard/profile');
    await expect(page.getByText('Welcome Jane Testperson!')).toBeVisible();

    // Guards every other test: if the app were pointed at a real Spring, this would fail.
    const requests = await stub.requests();
    expect(requests).toContainEqual({ method: 'GET', path: '/users/me', hasBearer: true });
    expect(requests).toContainEqual({ method: 'GET', path: '/resumes/analysis', hasBearer: true });
  });

  test.describe('a failed Analysis', () => {
    test('that cannot be retried shows a message and no Retry', async ({ page, stub }) => {
      await stub.set({
        latest: [
          analysis({ status: 'FAILED', error_code: 'TEXT_NOT_EXTRACTABLE', retryable: false }),
        ],
      });

      await page.goto('/dashboard/profile');

      await expect(panelAlert(page)).toHaveText(TEXT_NOT_EXTRACTABLE_COPY);
      await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
      // The user can still analyze another resume.
      await expect(page.getByRole('button', { name: 'Analyze' })).toBeEnabled();
    });

    test('that cannot be retried for an unreadable file also asks for a text-based PDF', async ({
      page,
      stub,
    }) => {
      await stub.set({
        latest: [analysis({ status: 'FAILED', error_code: 'FILE_UNREADABLE', retryable: false })],
      });

      await page.goto('/dashboard/profile');

      await expect(panelAlert(page)).toContainText('Upload a text-based PDF');
      await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
    });

    test('that can be retried offers Retry, which starts a new Analysis', async ({
      page,
      stub,
    }) => {
      await stub.set({
        latest: [analysis({ status: 'FAILED', error_code: 'INTERNAL_ERROR', retryable: true })],
        analyze: { status: 202, body: analysis({ status: 'PENDING' }) },
        afterAnalyze: [analysis({ status: 'PROCESSING' }), completed],
      });

      await page.goto('/dashboard/profile');
      await expect(panelAlert(page)).toHaveText(/Analysis didn't finish\./);

      await page.getByRole('button', { name: 'Retry' }).click();

      await expect(page.getByText('Analyzing your resume…')).toBeVisible();
      await expect(page.getByText('Overall')).toBeVisible({ timeout: 15_000 });

      const analyzeCalls = (await stub.requests()).filter(
        (r) => r.method === 'POST' && r.path === '/resumes/analyze'
      );
      expect(analyzeCalls).toHaveLength(1);
    });

    test('that timed out says so and offers Retry', async ({ page, stub }) => {
      await stub.set({
        latest: [analysis({ status: 'FAILED', error_code: 'ANALYSIS_TIMED_OUT', retryable: true })],
      });

      await page.goto('/dashboard/profile');

      await expect(panelAlert(page)).toContainText('it took too long');
      await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    });

    test('with a code the app does not know still offers Retry when the server says it can be retried', async ({
      page,
      stub,
    }) => {
      await stub.set({
        latest: [analysis({ status: 'FAILED', error_code: 'SOMETHING_NEW', retryable: true })],
      });

      await page.goto('/dashboard/profile');

      await expect(panelAlert(page)).toHaveText(/Analysis didn't finish\./);
      await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    });

    test('from an older server with no retryable flag offers Retry', async ({ page, stub }) => {
      await stub.set({
        latest: [analysis({ status: 'FAILED', error_code: 'INTERNAL_ERROR', retryable: null })],
      });

      await page.goto('/dashboard/profile');

      await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    });
  });

  test('polls a running Analysis through to its scores', async ({ page, stub }) => {
    await stub.set({
      latest: [analysis({ status: 'PROCESSING' }), analysis({ status: 'PROCESSING' }), completed],
    });

    await page.goto('/dashboard/profile');
    await expect(page.getByText('Analyzing your resume…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analyze' })).toBeDisabled();

    await expect(page.getByText('Overall')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('No issues found.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analyze' })).toBeEnabled();
  });

  test.describe('starting an Analysis', () => {
    test('is not possible without a confirmed resume', async ({ page, stub }) => {
      await stub.set({
        user: {
          firstName: 'Jane',
          lastName: 'Testperson',
          username: 'jane',
          email: 'jane.testperson@example.com',
          resumeId: null,
          resumeFileName: null,
          resumeUpdatedAt: null,
        },
      });

      await page.goto('/dashboard/profile');

      await expect(page.getByRole('button', { name: 'Analyze' })).toBeDisabled();
      await expect(page.getByText('Upload a resume to analyze it.')).toBeVisible();
    });

    test('rejected for a missing resume shows its own copy, not the raw body', async ({
      page,
      stub,
    }) => {
      await stub.set({
        analyze: {
          status: 404,
          body: { correlation_id: null, error_code: 'RESUME_NOT_FOUND', retryable: false },
        },
      });

      await page.goto('/dashboard/profile');
      await page.getByRole('button', { name: 'Analyze' }).click();

      await expect(panelAlert(page)).toHaveText('Upload a resume to analyze it.');
      expect(await page.content()).not.toContain('RESUME_NOT_FOUND');
    });

    test('that fails on the server shows generic copy and never the raw body', async ({
      page,
      stub,
    }) => {
      await stub.set({
        analyze: { status: 500, raw: 'Traceback: failed while reading Jane Testperson resume' },
      });

      await page.goto('/dashboard/profile');
      await page.getByRole('button', { name: 'Analyze' }).click();

      await expect(panelAlert(page)).toHaveText("Couldn't start the analysis. Please try again.");
      const html = await page.content();
      expect(html).not.toContain('Traceback');
      expect(html).not.toContain('reading Jane Testperson resume');
    });
  });
});
