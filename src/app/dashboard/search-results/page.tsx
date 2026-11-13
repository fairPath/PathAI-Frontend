import { isRedirectError } from 'next/dist/client/components/redirect-error';

import SearchResultsContainer from '@/components/search-results/search-results-container';
import { getJobSearchFilters } from '@/lib/job-search';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { serverApiFetch } from '@/lib/server-api-client';
import { User } from '@/types/User';

type SearchResultsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SearchResultsPage({ searchParams }: SearchResultsPageProps) {
  const filters = getJobSearchFilters(await searchParams);
  const token = (await cookies()).get('authToken')?.value;
  if (!token) redirect('/login?reason=unauthorized');
  // Identify this login's tab cache without exposing the HTTP-only token.
  const cacheScope = createHash('sha256').update(token).digest('hex');
  let currentResumeId: string | null = null;
  let initialError: string | null = null;

  try {
    const user = await serverApiFetch<User>('/users/me', { cache: 'no-store' });
    currentResumeId = user.resumeId;
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }
    initialError = error instanceof Error ? error.message : 'Failed to load jobs';
  }

  return (
    <SearchResultsContainer
      cacheScope={cacheScope}
      currentResumeId={currentResumeId}
      initialFilters={filters}
      initialError={initialError}
    />
  );
}
