import { NextRequest, NextResponse } from 'next/server';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { buildJobsBackendParams, getJobSearchFilters } from '@/lib/job-search';
import { serverApiFetch } from '@/lib/server-api-client';
import type { Job } from '@/types/Job';

export async function GET(request: NextRequest) {
  const filters = getJobSearchFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (Object.values(filters).some((value) => value.length > 1000)) {
    return NextResponse.json({ error: 'Search parameters are too long' }, { status: 400 });
  }
  const query = buildJobsBackendParams(filters).toString();
  try {
    const jobs = await serverApiFetch<Job[]>(query ? `/jobs?${query}` : '/jobs', {
      cache: 'no-store',
    });
    return NextResponse.json(jobs, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return NextResponse.json({ error: 'Unable to search jobs' }, { status: 503 });
  }
}
