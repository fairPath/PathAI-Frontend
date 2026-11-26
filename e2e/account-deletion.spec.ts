import type { Page } from '@playwright/test';

import { expect, test } from './support/fixtures';

const settingsPath = '/dashboard/settings';
const statusPath = '/account-deletion';
const deletionPath = '/account/deletion';
const statusEndpoint = '/auth/account-deletion/status';

async function openDeletionDialog(page: Page) {
  await page.goto(settingsPath);
  await page.getByRole('button', { name: 'Delete account', exact: true }).click();
  return page.getByRole('dialog', { name: 'Delete your account?' });
}

async function submitDeletion(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Delete your account?' });
  await dialog.getByLabel('Current password').fill('synthetic-password');
  await dialog.getByRole('button', { name: 'Permanently delete account' }).click();
}

test('normal deletion polls, signs out, and retains completion after refresh in this tab', async ({
  page,
  context,
  stub,
}) => {
  await openDeletionDialog(page);
  await submitDeletion(page);
  await expect(page).toHaveURL(statusPath);
  await expect(page.getByRole('heading', { name: 'Deletion requested' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('if you recently started a résumé upload');
  expect((await context.cookies()).some(({ name }) => name === 'authToken')).toBe(false);
  await expect
    .poll(() => stub.requests())
    .toEqual(
      expect.arrayContaining([
        { method: 'POST', path: deletionPath, hasBearer: true },
        { method: 'POST', path: statusEndpoint, hasBearer: false },
      ])
    );

  await stub.set({ deletionStatus: { status: 200, body: { status: 'completed' } } });
  const completion = page.getByText('Your account and all its data have been deleted.');
  await expect(completion).toBeVisible({ timeout: 10_000 });

  await stub.set({ deletionStatus: { status: 200, body: { status: 'missing' } } });
  const beforeReload = (await stub.requests()).filter(({ path }) => path === statusEndpoint);
  await page.reload();
  await expect(completion).toBeVisible();
  expect((await stub.requests()).filter(({ path }) => path === statusEndpoint)).toEqual(
    beforeReload
  );

  const otherTab = await context.newPage();
  await otherTab.goto(statusPath);
  await expect(
    otherTab.getByText('You may receive a confirmation email.', { exact: false })
  ).toBeVisible();
  await otherTab.close();
  await page.getByRole('link', { name: 'Return to sign in' }).click();
  await expect(page).toHaveURL('/login');
  await page.goto(settingsPath);
  await expect(page).toHaveURL('/login?reason=unauthorized');
});

test('a failed status check stays pending and a missing receipt later confirms completion', async ({
  page,
  stub,
}) => {
  await stub.set({ deletionStatus: { status: 503, body: { message: 'Unavailable' } } });
  await openDeletionDialog(page);
  await submitDeletion(page);
  await expect(page.getByRole('heading', { name: 'Deletion requested' })).toBeVisible();
  await expect
    .poll(async () => (await stub.requests()).some(({ path }) => path === statusEndpoint))
    .toBe(true);
  await expect(page.getByRole('heading', { name: 'Deletion completed' })).toBeHidden();

  await stub.set({ deletionStatus: { status: 200, body: { status: 'missing' } } });
  await expect(page.getByRole('heading', { name: 'Deletion completed' })).toBeVisible({
    timeout: 10_000,
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Deletion completed' })).toBeVisible();
});

test('retrying after a lost success response signs out without claiming completion', async ({
  page,
  context,
  stub,
}) => {
  await stub.set({ dropDeletionReply: true });
  const dialog = await openDeletionDialog(page);
  await submitDeletion(page);
  await expect(
    dialog.getByText('Could not request account deletion. Please try again.')
  ).toBeVisible();
  expect((await context.cookies()).some(({ name }) => name === 'authToken')).toBe(true);

  await submitDeletion(page);
  await expect(page).toHaveURL(statusPath);
  await expect(page.getByRole('status')).toContainText(
    'Your account is being deleted. You may receive a confirmation email.'
  );
  await expect(page.getByRole('heading', { name: 'Deletion completed' })).toBeHidden();
  expect((await context.cookies()).some(({ name }) => name === 'authToken')).toBe(false);
  const requests = await stub.requests();
  expect(requests.filter(({ path }) => path === deletionPath)).toHaveLength(2);
  expect(requests.some(({ path }) => path === statusEndpoint)).toBe(false);
});

test('double-clicking confirm submits only one deletion request', async ({ page, stub }) => {
  const dialog = await openDeletionDialog(page);
  await dialog.getByLabel('Current password').fill('synthetic-password');
  await dialog.getByRole('button', { name: 'Permanently delete account' }).dblclick();
  await expect(page).toHaveURL(statusPath);
  await expect(page.getByRole('heading', { name: 'Deletion requested' })).toBeVisible();
  expect((await stub.requests()).filter(({ path }) => path === deletionPath)).toHaveLength(1);
});

test('an expired session still redirects to sign-in', async ({ page, stub }) => {
  await stub.set({ deletion: { status: 401, body: { code: 'TOKEN_EXPIRED' } } });
  await openDeletionDialog(page);
  await submitDeletion(page);
  await expect(page).toHaveURL('/login?reason=unauthorized');
});

test('cancel and wrong-password handling keep the existing settings and session', async ({
  page,
  context,
  stub,
}) => {
  await stub.set({ deletion: { status: 400, body: { message: 'Incorrect password' } } });
  const dialog = await openDeletionDialog(page);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  expect((await stub.requests()).some(({ path }) => path === deletionPath)).toBe(false);

  await page.getByRole('button', { name: 'Delete account', exact: true }).click();
  await submitDeletion(page);
  await expect(dialog.getByText('That password is incorrect.')).toBeVisible();
  await expect(page).toHaveURL(settingsPath);
  expect((await context.cookies()).some(({ name }) => name === 'authToken')).toBe(true);
});
