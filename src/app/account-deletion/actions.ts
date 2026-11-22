'use server';

import { cookies } from 'next/headers';

import { ApiError, serverApiFetch } from '@/lib/server-api-client';

export async function requestAccountDeletion(password: string) {
  try {
    const { token } = await serverApiFetch<{ token: string }>('/account/deletion', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    (await cookies()).delete('authToken');
    return { token };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        error:
          error.status === 400
            ? 'That password is incorrect.'
            : 'Could not request account deletion. Please try again.',
      };
    }
    throw error;
  }
}

export async function getDeletionStatus(token: string) {
  const response = await fetch(`${process.env.SPRING_BASE_URL}/auth/account-deletion/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Could not check deletion status');
  const { status } = (await response.json()) as { status: string };
  return status;
}
