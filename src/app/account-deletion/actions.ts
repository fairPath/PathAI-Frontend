'use server';

import { cookies } from 'next/headers';

import { ApiError, serverApiFetch } from '@/lib/server-api-client';
import type { ActionResult } from '@/types/action-result';

type DeletionStatus = 'requested' | 'missing';
const ACCOUNT_UNAVAILABLE = 'ACCOUNT_UNAVAILABLE';

export async function requestAccountDeletion(
  password: string
): Promise<ActionResult<{ token: string | null }>> {
  try {
    const { token } = await serverApiFetch<{ token: string }>('/account/deletion', {
      method: 'POST',
      body: JSON.stringify({ password }),
      handleUnauthorizedCode: ACCOUNT_UNAVAILABLE,
    });
    (await cookies()).delete('authToken');
    return { ok: true, data: { token } };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401 && error.errorCode === ACCOUNT_UNAVAILABLE) {
        (await cookies()).delete('authToken');
        return { ok: true, data: { token: null } };
      }
      return {
        ok: false,
        error:
          error.status === 400
            ? 'That password is incorrect.'
            : 'Could not request account deletion. Please try again.',
      };
    }
    throw error;
  }
}

export async function getDeletionStatus(token: string): Promise<DeletionStatus> {
  const response = await fetch(`${process.env.SPRING_BASE_URL}/auth/account-deletion/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Could not check deletion status');
  const { status } = (await response.json()) as { status: DeletionStatus };
  return status;
}
