'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Job } from '@/types/Job';
import {
  buildSearchResultsParams,
  getJobSearchFilters,
  type JobSearchFilters,
} from '@/lib/job-search';
import {
  loadSearchSnapshot,
  mergeSavedSearchJobs,
  saveSearchSnapshot,
  searchKey,
  type SearchSnapshot,
} from '@/lib/job-search-session';

class AuthenticationRequired extends Error {}

async function fetchJobs(path: string): Promise<Job[]> {
  const response = await fetch(path, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
  if (response.redirected || response.status === 401) throw new AuthenticationRequired();
  if (!response.ok) throw new Error('Unable to load jobs. Please try again.');
  const jobs: Job[] = await response.json();
  if (!Array.isArray(jobs)) throw new Error('The job service returned an invalid response.');
  return jobs;
}

type SearchState = SearchSnapshot & {
  ready: boolean;
  loading: boolean;
  error: string | null;
  statusError: boolean;
};

export function useJobSearchSession(
  scope: string,
  initialFilters: JobSearchFilters,
  initialError: string | null
) {
  const params = useSearchParams();
  const query = searchKey(getJobSearchFilters(Object.fromEntries(params.entries())));
  const requestId = params.get('_search') ?? '';
  const [state, setState] = useState<SearchState>({
    filters: initialFilters,
    draftFilters: initialFilters,
    jobs: [],
    selectedJobId: null,
    hasSearched: false,
    requestIds: [],
    ready: false,
    loading: false,
    error: initialError,
    statusError: false,
  });

  useEffect(() => {
    let cancelled = false;
    const filters = getJobSearchFilters(Object.fromEntries(new URLSearchParams(query).entries()));
    setState((current) => ({
      ...current,
      ready: false,
      loading: true,
      error: null,
      statusError: false,
    }));
    void (async () => {
      try {
        const { snapshot, restored } = await loadSearchSnapshot(
          scope,
          filters,
          requestId,
          (filters) => fetchJobs(`/api/jobs/search?${buildSearchResultsParams(filters)}`)
        );
        if (cancelled) return;
        setState({
          ...snapshot,
          ready: true,
          loading: false,
          error: initialError,
          statusError: false,
        });

        if (!query && restored && searchKey(snapshot.filters)) {
          const restoredParams = buildSearchResultsParams(snapshot.filters);
          window.history.replaceState(null, '', `/dashboard/search-results?${restoredParams}`);
          return;
        }
        if (restored && snapshot.jobs.length) {
          const ids = new URLSearchParams();
          snapshot.jobs.forEach((job) => ids.append('jobId', job.jobId));
          try {
            const saved = await fetchJobs(`/api/saved-jobs/status?${ids}`);
            if (!cancelled)
              setState((current) => ({
                ...current,
                jobs: mergeSavedSearchJobs(current.jobs, saved),
              }));
          } catch (error) {
            if (cancelled) return;
            if (error instanceof AuthenticationRequired)
              window.location.assign('/login?reason=unauthorized');
            else setState((current) => ({ ...current, statusError: true }));
          }
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof AuthenticationRequired) {
          window.location.assign('/login?reason=unauthorized');
          return;
        }
        setState((current) => ({
          ...current,
          filters,
          draftFilters: filters,
          ready: true,
          loading: false,
          error: error instanceof Error ? error.message : 'Unable to load jobs.',
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, query, requestId, initialError]);

  useEffect(() => {
    if (state.ready && !state.loading && !state.error && state.hasSearched)
      saveSearchSnapshot(scope, state);
  }, [scope, state]);

  const setFilter = (key: keyof JobSearchFilters, value: string) => {
    setState((current) => ({
      ...current,
      draftFilters: { ...current.draftFilters, [key]: value },
    }));
  };
  const search = () => {
    const next = buildSearchResultsParams(state.draftFilters);
    next.set('_search', crypto.randomUUID());
    window.history.pushState(null, '', `/dashboard/search-results?${next}`);
  };
  const updateSavedJob = (job: Job) =>
    setState((current) => ({
      ...current,
      jobs: current.jobs.map((item) => (item.jobId === job.jobId ? job : item)),
    }));
  const setSelectedJob = (job: Job | null) =>
    setState((current) => ({ ...current, selectedJobId: job?.jobId ?? null }));
  const selectedJob = state.jobs.find((job) => job.jobId === state.selectedJobId) ?? null;
  return { ...state, setFilter, search, updateSavedJob, setSelectedJob, selectedJob };
}
