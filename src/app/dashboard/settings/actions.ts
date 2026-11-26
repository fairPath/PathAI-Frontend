'use server';

import { unstable_rethrow } from 'next/navigation';

import { serverApiFetch } from '@/lib/server-api-client';
import type { ActionResult } from '@/types/action-result';

const path = '/users/me/daily-job-match';
type Preference = { enabled: boolean };

export async function getDailyJobMatch(): Promise<ActionResult<Preference>> {
  try {
    const data = await serverApiFetch<Preference>(path, { cache: 'no-store' });
    return { ok: true, data };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: 'Could not load Daily Job Match. Please refresh to try again.' };
  }
}

export async function setDailyJobMatch(enabled: boolean): Promise<ActionResult<Preference>> {
  try {
    const data = await serverApiFetch<Preference>(path, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
    return { ok: true, data };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: 'Could not save Daily Job Match. Please try again.' };
  }
}
