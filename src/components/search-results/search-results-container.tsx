'use client';

import { Input } from '../ui/input';
import { LocateFixedIcon, Search } from 'lucide-react';
import JobFilters from './job-filters';
import { Button } from '@/components/ui/button';
import JobTable from './job-table';
import Loading from '@/components/ui/loading';
import { type JobSearchFilters } from '@/lib/job-search';
import { useJobSearchSession } from '@/hooks/use-job-search-session';

type SearchResultsContainerProps = {
  cacheScope: string;
  currentResumeId: string | null;
  initialFilters: JobSearchFilters;
  initialError?: string | null;
};

const SearchResultsContainer = ({
  cacheScope,
  currentResumeId,
  initialFilters,
  initialError = null,
}: SearchResultsContainerProps) => {
  const session = useJobSearchSession(cacheScope, initialFilters, initialError);
  const filters = session.draftFilters;

  if (!session.ready) return <Loading message="Loading your search…" />;

  return (
    <div className="flex min-h-0 flex-col px-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          session.search();
        }}
      >
        <fieldset disabled={session.loading}>
          <div className="mb-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <label className="relative min-w-0">
              <span className="sr-only">Job role</span>
              <Search className="absolute left-2 top-2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="text"
                placeholder="Job Role..."
                value={filters.titleOnly}
                onChange={(event) => session.setFilter('titleOnly', event.target.value)}
                className="rounded-md focus:outline-none pl-9"
              />
            </label>
            <label className="relative min-w-0">
              <span className="sr-only">Location</span>
              <LocateFixedIcon
                className="absolute left-2 top-2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="text"
                placeholder="City, state, or zip code..."
                value={filters.where}
                onChange={(event) => session.setFilter('where', event.target.value)}
                className="rounded-md focus:outline-none pl-9"
              />
            </label>
            <Button type="submit" className="bg-purple-700 text-white hover:bg-blue-600">
              Search
            </Button>
          </div>
          <div className="mb-8 flex flex-wrap justify-center pr-3">
            <JobFilters
              jobTypeFilter={filters.jobType}
              setJobTypeFilter={(value) => session.setFilter('jobType', value)}
              salaryFilter={filters.salary}
              setSalaryFilter={(value) => session.setFilter('salary', value)}
              companyFilter={filters.company}
              setCompanyFilter={(value) => session.setFilter('company', value)}
            />
          </div>
        </fieldset>
      </form>
      {session.error && (
        <p role="alert" className="mb-4 text-destructive">
          {session.error}
        </p>
      )}
      {session.statusError && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Your search is restored, but saved-job status could not be refreshed.
        </p>
      )}
      {session.loading && <Loading message="Searching jobs…" />}
      {!session.loading && !session.error && session.jobs.length === 0 && (
        <div className="flex min-h-64 flex-col items-center justify-center">
          <h2 className="text-2xl font-bold">
            {session.hasSearched ? 'No jobs found' : 'Search for jobs'}
          </h2>
          <p className="text-gray-500">
            {session.hasSearched
              ? 'Try different search criteria.'
              : 'Enter your criteria and select Search.'}
          </p>
        </div>
      )}
      {!session.loading && session.jobs.length > 0 && (
        <div className="flex min-h-0 flex-col items-stretch gap-4 lg:flex-row lg:items-start lg:justify-center">
          <JobTable
            jobs={session.jobs}
            currentResumeId={currentResumeId}
            selectedJob={session.selectedJob}
            setSelectedJob={session.setSelectedJob}
            updateSavedJob={session.updateSavedJob}
          />
        </div>
      )}
    </div>
  );
};

export default SearchResultsContainer;
