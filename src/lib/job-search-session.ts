import type { Job } from '@/types/Job';
import { buildSearchResultsParams, type JobSearchFilters } from '@/lib/job-search';

export type SearchSnapshot = {
  filters: JobSearchFilters;
  draftFilters: JobSearchFilters;
  jobs: Job[];
  selectedJobId: string | null;
  hasSearched: boolean;
  requestIds: string[];
};

type SearchCache = { version: 1; entries: SearchSnapshot[] };
const memory = new Map<string, SearchCache>();
const pending = new Map<string, Promise<SearchSnapshot>>();
const latestIntent = new Map<string, string>();
const prefix = 'fairpath:job-search:';
export const searchKey = (filters: JobSearchFilters) =>
  buildSearchResultsParams(filters).toString();

function validFilters(value: unknown): value is JobSearchFilters {
  if (!value || typeof value !== 'object') return false;
  return ['titleOnly', 'where', 'jobType', 'salary', 'company'].every(
    (key) => typeof (value as Record<string, unknown>)[key] === 'string'
  );
}

function readCache(scope: string): SearchCache {
  try {
    const raw = window.sessionStorage.getItem(prefix + scope);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.version === 1 && Array.isArray(parsed.entries)) {
        const entries = parsed.entries.filter(
          (entry: SearchSnapshot) =>
            entry &&
            validFilters(entry.filters) &&
            validFilters(entry.draftFilters) &&
            Array.isArray(entry.jobs) &&
            entry.jobs.every((job) => job && typeof job.jobId === 'string') &&
            Array.isArray(entry.requestIds) &&
            entry.requestIds.every((id) => typeof id === 'string') &&
            typeof entry.hasSearched === 'boolean' &&
            (entry.selectedJobId === null || typeof entry.selectedJobId === 'string')
        );
        const cache: SearchCache = { version: 1, entries: entries.slice(0, 5) };
        memory.set(scope, cache);
        return cache;
      }
    }
  } catch {
    /* Storage can be disabled, full, or contain an old/corrupt entry. */
  }
  return memory.get(scope) ?? { version: 1, entries: [] };
}

export function saveSearchSnapshot(scope: string, snapshot: SearchSnapshot, activate = true) {
  const previous = readCache(scope);
  const key = searchKey(snapshot.filters);
  const existing = previous.entries.find((entry) => searchKey(entry.filters) === key);
  const otherEntries = previous.entries.filter((entry) => searchKey(entry.filters) !== key);
  const cache: SearchCache = {
    version: 1,
    entries:
      !activate && existing
        ? previous.entries.map((entry) =>
            entry === existing
              ? {
                  ...entry,
                  requestIds: [...new Set([...entry.requestIds, ...snapshot.requestIds])].slice(
                    -20
                  ),
                }
              : entry
          )
        : (activate ? [snapshot, ...otherEntries] : [...otherEntries, snapshot]).slice(0, 5),
  };
  memory.set(scope, cache);
  try {
    window.sessionStorage.setItem(prefix + scope, JSON.stringify(cache));
  } catch {
    /* Keep the in-memory copy when browser storage is unavailable. */
  }
}

export async function loadSearchSnapshot(
  scope: string,
  filters: JobSearchFilters,
  requestId: string,
  search: (filters: JobSearchFilters) => Promise<Job[]>
): Promise<{ snapshot: SearchSnapshot; restored: boolean }> {
  const key = searchKey(filters);
  const cache = readCache(scope);
  const cached =
    !key && !requestId
      ? cache.entries[0]
      : cache.entries.find((entry) => searchKey(entry.filters) === key);
  if (cached && (!requestId || cached.requestIds.includes(requestId))) {
    latestIntent.set(scope, `cached:${searchKey(cached.filters)}`);
    return { snapshot: cached, restored: true };
  }
  if (!key && !requestId && !cached) {
    return {
      snapshot: {
        filters,
        draftFilters: filters,
        jobs: [],
        selectedJobId: null,
        hasSearched: false,
        requestIds: [],
      },
      restored: false,
    };
  }

  // Reuse an in-flight search across navigation and React's development effect replay.
  const pendingKey = JSON.stringify([scope, key, requestId]);
  latestIntent.set(scope, pendingKey);
  let work = pending.get(pendingKey);
  if (!work) {
    work = search(filters)
      .then((jobs) => {
        const snapshot: SearchSnapshot = {
          filters,
          draftFilters: filters,
          jobs,
          selectedJobId: null,
          hasSearched: true,
          requestIds: [...(cached?.requestIds ?? []), ...(requestId ? [requestId] : [])].slice(-20),
        };
        saveSearchSnapshot(scope, snapshot, latestIntent.get(scope) === pendingKey);
        return snapshot;
      })
      .finally(() => pending.delete(pendingKey));
    pending.set(pendingKey, work);
  }
  return { snapshot: await work, restored: false };
}

/** Refresh saved/comparison metadata while preserving the original search result text/order. */
export function mergeSavedSearchJobs(jobs: Job[], savedJobs: Job[]): Job[] {
  const saved = new Map(savedJobs.map((job) => [job.jobId, job]));
  return jobs.map((job) => {
    const current = saved.get(job.jobId);
    if (current) return { ...job, ...current, jobDescription: job.jobDescription };
    return {
      ...job,
      saved: false,
      comparisonRequestId: null,
      comparisonStatus: null,
      resumeId: null,
      resumeSnapshot: null,
      matchScore: null,
      matchedSkills: null,
      missingSkills: null,
      relevantExperience: null,
      otherGaps: null,
    };
  });
}
