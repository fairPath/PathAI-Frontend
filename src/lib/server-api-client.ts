import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly errorCode: string | null,
    public readonly retryable: boolean,
    public readonly correlationId: string | null
  ) {
    super(message);
  }
}

type ApiOptions = Omit<RequestInit, 'headers'>;

export const serverApiFetch = async <T = void>(path: string, options?: ApiOptions): Promise<T> => {
  const token = (await cookies()).get('authToken')?.value;

  const response = await fetch(`${process.env.SPRING_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (response.status === 401) {
    redirect('/login?reason=unauthorized');
  }
  if (!response.ok) {
    if (path !== '/saved-jobs/compare') {
      const detail = await response.text();
      const message =
        response.status === 403
          ? 'Access to this resource was denied.'
          : response.status === 409 && path === '/saved-jobs/prepare'
            ? 'You can save up to 150 jobs. Delete a saved job before adding another.'
            : detail || `API request failed with status ${response.status}`;
      throw new Error(message);
    }
    let envelope: { error_code?: string; retryable?: boolean; correlation_id?: string } = {};
    try {
      envelope = await response.json();
    } catch {
      /* Never expose raw upstream bodies. */
    }
    const message =
      response.status === 403
        ? 'Access to this resource was denied.'
        : 'The request could not be completed. Please try again.';
    throw new ApiError(
      message,
      envelope.error_code ?? null,
      envelope.retryable ?? [408, 429, 502, 503, 504].includes(response.status),
      envelope.correlation_id ?? null
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return (text ? text : undefined) as T;
};
