'use client';

import { Job } from '@/types/Job';
import { Building2 } from 'lucide-react';

interface JobCardProps {
  job: Job;
}
const JobCard = ({ job }: JobCardProps) => {
  return (
    <>
      <div className="flex items-center justify-between">
        {job.title}
        <div className="flex items-center justify-end gap-2 pr-3 pt-2 ml-5 shrink-0">
          {job.matchScore !== null && (
            <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-800">
              {job.matchScore}% match
            </span>
          )}
          <Building2 />
        </div>
      </div>

      {job.saved && job.comparisonStatus === 'PENDING' && (
        <p role="status" className="mt-2 text-sm text-purple-700">
          Comparison in progress…
        </p>
      )}
      {job.saved && job.comparisonStatus === 'FAILED' && (
        <p className="mt-2 text-sm text-destructive">
          Comparison failed. Open job details to retry.
        </p>
      )}
      <div className="text-gray-700 mt-2">{job.companyName}</div>

      <div className="text-gray-500 mt-1">{job.location}</div>
      <div className="flex flex-row gap-2 mt-2 justify-between">
        <div className="pt-1">{`$${job.salaryMin} - $${job.salaryMax}`}</div>
      </div>
    </>
  );
};

export default JobCard;
