import { expect, panelAlert, test } from './support/fixtures';

test('saves Daily Job Match, restores it on reload, and keeps the saved state on failure', async ({
  page,
  stub,
}) => {
  await page.goto('/dashboard/settings');
  const toggle = page.getByRole('switch', { name: 'Daily Job Match' });
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(page.getByRole('status')).toHaveText('Daily Job Match is on.');
  await page.reload();
  await expect(toggle).toBeChecked();

  await stub.set({ dailyJobMatchSaveStatus: 503 });
  await toggle.click();
  await expect(panelAlert(page)).toContainText('Could not save Daily Job Match.');
  await expect(toggle).toBeChecked();

  await stub.set({ dailyJobMatchSaveStatus: 200 });
  await toggle.click();
  await expect(page.getByRole('status')).toHaveText('Daily Job Match is off.');
  await expect(toggle).not.toBeChecked();
});
