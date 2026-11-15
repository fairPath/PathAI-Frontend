import { NextRequest, NextResponse } from 'next/server';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { serverApiFetch } from '@/lib/server-api-client';
import { Job } from '@/types/Job';

export async function GET(request: NextRequest) {
  const ids = [...new Set(request.nextUrl.searchParams.getAll('jobId'))];
  if (ids.length === 0 || ids.length > 150 || ids.some((id) => !id.trim() || id.length > 200)) {
    return NextResponse.json({ error: 'Invalid job IDs' }, { status: 400 });
  }
  const params = new URLSearchParams();
  ids.forEach((id) => params.append('jobId', id));
  try {
    const jobs = await serverApiFetch<Job[]>(`/saved-jobs/status?${params}`, { cache: 'no-store' });
    return NextResponse.json(jobs, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return NextResponse.json({ error: 'Unable to refresh comparisons' }, { status: 503 });
  }
}
