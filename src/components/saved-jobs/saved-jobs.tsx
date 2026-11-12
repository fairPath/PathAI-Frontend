'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import JobTable from '../search-results/job-table';
import { Job } from '@/types/Job';

interface SavedJobsProps {
  jobs: Job[] | undefined;
}
const SavedJobs = ({ jobs }: SavedJobsProps) => {
  const router = useRouter();
  const [savedJobs, setSavedJobs] = useState<Job[] | undefined>(jobs);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const updateSavedJob = (job: Job) => {
    setSavedJobs((currentJobs) =>
      (currentJobs ?? []).flatMap((currentJob) => {
        if (currentJob.jobId !== job.jobId) return [currentJob];
        return job.saved ? [job] : [];
      })
    );
    setSelectedJob((currentJob) =>
      currentJob?.jobId === job.jobId ? (job.saved ? job : null) : currentJob
    );
  };
  return (
    <>
      {(!savedJobs || savedJobs.length === 0) && (
        <div className="flex flex-col items-center justify-center h-screen">
          <h2 className="text-2xl font-bold">No saved jobs found</h2>
          <p className="text-gray-500">Try saving jobs on dashboard.</p>
          <Button
            onClick={() => router.push('/dashboard')}
            className="mt-4 bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition duration-200"
          >
            Back to Dashboard
          </Button>
        </div>
      )}
      {savedJobs && savedJobs.length > 0 && (
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center justify-center gap-x-2 mb-6">
            <div className="text-4xl font-semibold text-foreground">Saved Jobs</div>
          </div>
          <div className="flex min-h-0 flex-col items-stretch gap-4 lg:flex-row lg:items-start lg:justify-center">
            <JobTable
              jobs={savedJobs || []}
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

export default SavedJobs;
