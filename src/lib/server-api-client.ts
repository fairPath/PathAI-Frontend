import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

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
    const detail = await response.text();
    const message =
      response.status === 403
        ? 'Access to this resource was denied.'
        : response.status === 409
          ? 'You can save up to 150 jobs. Delete a saved job before adding another.'
          : detail || `API request failed with status ${response.status}`;
    throw new Error(message);
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
