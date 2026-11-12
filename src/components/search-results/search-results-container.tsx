'use client';

import { useEffect, useState, useTransition } from 'react';
import { Input } from '../ui/input';
import { LocateFixedIcon, Search } from 'lucide-react';
import JobFilters from './job-filters';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import JobTable from './job-table';
import { Job } from '@/types/Job';
import Loading from '../ui/loading';
import { buildSearchResultsParams, JobSearchFilters } from '@/lib/job-search';

type SearchResultsContainerProps = {
  initialJobs: Job[];
  initialFilters: JobSearchFilters;
  initialError?: string | null;
};

const SearchResultsContainer = ({
  initialJobs,
  initialFilters,
  initialError = null,
}: SearchResultsContainerProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [searchRole, setSearchRole] = useState<string>(initialFilters.titleOnly);
  const [searchLocation, setSearchLocation] = useState<string>(initialFilters.where);
  const [jobTypeFilter, setJobTypeFilter] = useState<string>(initialFilters.jobType);
  const [salaryFilter, setSalaryFilter] = useState<string>(initialFilters.salary);
  const [companyFilter, setCompanyFilter] = useState<string>(initialFilters.company);

  useEffect(() => {
    setJobs(initialJobs);
    setError(initialError);
    setSelectedJob(null);
  }, [initialError, initialJobs]);

  useEffect(() => {
    setSearchRole(initialFilters.titleOnly);
    setSearchLocation(initialFilters.where);
    setJobTypeFilter(initialFilters.jobType);
    setSalaryFilter(initialFilters.salary);
    setCompanyFilter(initialFilters.company);
  }, [initialFilters]);

  const updateSavedJob = (job: Job) => {
    setJobs((currentJobs) =>
      currentJobs.map((currentJob) => (currentJob.jobId === job.jobId ? job : currentJob))
    );
    setSelectedJob((currentJob) => (currentJob?.jobId === job.jobId ? job : currentJob));
  };

  const searchJobs = () => {
    const params = buildSearchResultsParams({
      titleOnly: searchRole,
      where: searchLocation,
      jobType: jobTypeFilter,
      salary: salaryFilter,
      company: companyFilter,
    });
    const query = params.toString();

    setError(null);
    startTransition(() => {
      router.push(query ? `/dashboard/search-results?${query}` : '/dashboard/search-results');
    });
  };

  if (isPending) {
    return <Loading message={'Loading...'} />;
  }

  return (
    <>
      {error && <div>error loading jobs: {error}</div>}
      {!error && jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center h-screen">
          <h2 className="text-2xl font-bold">No jobs found</h2>
          <p className="text-gray-500">Try a different search.</p>
          <Button
            onClick={() => router.push('/dashboard')}
            className="mt-4 bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition duration-200"
          >
            Back to Dashboard
          </Button>
        </div>
      )}
      {!error && jobs.length > 0 && (
        <div className="flex min-h-0 flex-col px-4">
          {/* Search Inputs */}
          <div className="flex items-center justify-center gap-x-2 mb-6">
            <label className="relative">
              <Search className="absolute left-2 top-2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Job Role..."
                value={searchRole}
                onChange={(e) => setSearchRole(e.target.value)}
                className="rounded-md focus:outline-none pl-9"
              />
            </label>

            <label className="relative">
              <LocateFixedIcon className="absolute left-2 top-2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="City, state, or zip code..."
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                className="rounded-md focus:outline-none pl-9"
              />
            </label>

            <Button
              onClick={() => searchJobs()}
              className="bg-purple-700 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition duration-200"
            >
              Search
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap justify-center mb-8 pr-3">
            <JobFilters
              jobTypeFilter={jobTypeFilter}
              setJobTypeFilter={setJobTypeFilter}
              salaryFilter={salaryFilter}
              setSalaryFilter={setSalaryFilter}
              companyFilter={companyFilter}
              setCompanyFilter={setCompanyFilter}
            />
          </div>

          {/* Job Card Table */}
          <div className="flex min-h-0 flex-col items-stretch gap-4 lg:flex-row lg:items-start lg:justify-center">
            <JobTable
              jobs={jobs}
              selectedJob={selectedJob}
              setSelectedJob={setSelectedJob}
              updateSavedJob={updateSavedJob}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default SearchResultsContainer;
