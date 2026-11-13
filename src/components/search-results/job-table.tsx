'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import JobCard from './job-card';
import JobDescription from './job-description';
import { Job } from '@/types/Job';
import { ChevronUp, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useJobComparisonPolling } from '@/hooks/use-job-comparison-polling';

import { deleteSavedJob, saveJob } from '@/app/dashboard/search-results/action';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface JobTableProps {
  jobs: Job[]; // Replace 'any' with the actual type of your jobs array
  currentResumeId: string | null;
  selectedJob: Job | null;
  setSelectedJob: (job: Job | null) => void;
  updateSavedJob: (jobs: Job) => void;
}

const JobTable = ({
  jobs,
  currentResumeId,
  selectedJob,
  setSelectedJob,
  updateSavedJob,
}: JobTableProps) => {
  const [savingJobIds, setSavingJobIds] = useState<Set<string>>(new Set());
  const pollingError = useJobComparisonPolling(jobs, updateSavedJob, savingJobIds);
  const detailsRef = useRef<HTMLDivElement>(null);
  const mobileDetailsButtonRef = useRef<HTMLButtonElement>(null);
  const detailsId = useId();
  const selectedJobId = selectedJob?.jobId;

  useEffect(() => {
    const details = detailsRef.current;
    if (!selectedJobId || !details) return;
    details.scrollTop = 0;
    if (window.matchMedia('(max-width: 1023px)').matches) {
      mobileDetailsButtonRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedJobId]);

  const selectJob = (job: Job) => {
    const collapse =
      selectedJobId === job.jobId && window.matchMedia('(max-width: 1023px)').matches;
    setSelectedJob(collapse ? null : job);
  };

  const handleClick = async (job: Job) => {
    if (savingJobIds.has(job.jobId)) return;
    const saved = !job.saved;
    const updatedJob: Job = saved
      ? { ...job, saved }
      : {
          ...job,
          saved,
          resumeId: null,
          resumeSnapshot: null,
          matchScore: null,
          matchedSkills: null,
          missingSkills: null,
          relevantExperience: null,
          otherGaps: null,
          comparisonStatus: null,
          comparisonRequestId: null,
        };
    setSavingJobIds((current) => new Set(current).add(job.jobId));
    try {
      if (saved) {
        const result = await saveJob(updatedJob);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        updateSavedJob(result.data);
        if (result.data.comparisonStatus === 'FAILED') {
          toast.error(
            'Job saved, but resume compatibility analysis failed. You can retry from the job details.'
          );
        } else if (result.data.comparisonStatus === 'PENDING') {
          toast.success('Job saved. Comparison in progress.');
        } else if (result.data.matchScore !== null) {
          toast.success(`Job saved with a ${result.data.matchScore}% resume match.`);
        } else {
          toast.success('Job saved. Upload a resume to check compatibility.');
        }
      } else {
        const result = await deleteSavedJob(job.jobId);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        updateSavedJob(updatedJob);
        toast.success('Job removed from saved jobs.');
      }
    } finally {
      setSavingJobIds((current) => {
        const next = new Set(current);
        next.delete(job.jobId);
        return next;
      });
    }
  };

  return (
    <>
      <div className="grid max-h-[70dvh] min-h-0 w-full grid-cols-1 gap-4 overflow-y-auto pr-2 pb-4 lg:max-w-lg lg:flex-1">
        {pollingError && (
          <p role="status" className="text-sm text-muted-foreground">
            Unable to refresh comparisons. Retrying…
          </p>
        )}
        {jobs.map((job, index) => (
          <React.Fragment key={job.jobId}>
            <motion.div
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              onClick={() => selectJob(job)}
              role="button"
              tabIndex={0}
              aria-expanded={selectedJob?.jobId === job.jobId}
              aria-controls={
                selectedJob?.jobId === job.jobId ? `${detailsId}-inline ${detailsId}` : detailsId
              }
              onKeyDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  (event.key === 'Enter' || event.key === ' ')
                ) {
                  event.preventDefault();
                  selectJob(job);
                }
              }}
              viewport={{ once: false, amount: 0.1 }}
              transition={{ duration: 0.3, delay: index * 0.02 }}
              className="bg-white w-full min-w-0 shadow-md rounded-lg p-4 hover:shadow-lg hover:bg-purple-100 transition-shadow duration-200 cursor-pointer"
            >
              <JobCard job={job} />
              <div className=" flex fill-purple-600">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={savingJobIds.has(job.jobId)}
                  aria-label={job.saved ? 'Remove saved job' : 'Save job and compare resume'}
                  aria-pressed={job.saved}
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleClick(job);
                  }}
                >
                  <Star className="text-purple-600" fill={job.saved ? 'currentColor' : 'none'} />
                </Button>
              </div>
            </motion.div>
            {selectedJob?.jobId === job.jobId && (
              <div
                id={`${detailsId}-inline`}
                className="min-w-0 pb-4 lg:hidden"
                role="region"
                aria-label="Expanded job details and resume comparison"
              >
                <Button
                  ref={mobileDetailsButtonRef}
                  variant="ghost"
                  className="mb-2"
                  onClick={() => setSelectedJob(null)}
                >
                  <ChevronUp aria-hidden="true" />
                  Hide details
                </Button>
                <JobDescription
                  job={selectedJob}
                  currentResumeId={currentResumeId}
                  onSaved={updateSavedJob}
                  onToggleSaved={handleClick}
                  isSaving={savingJobIds.has(job.jobId)}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
      <div
        ref={detailsRef}
        id={detailsId}
        className="hidden max-h-[70dvh] min-h-0 min-w-0 w-full overflow-y-auto pb-8 lg:block lg:max-w-2xl lg:flex-1"
        role="region"
        aria-label="Job details and resume comparison"
        tabIndex={0}
      >
        <JobDescription
          job={selectedJob}
          currentResumeId={currentResumeId}
          onSaved={updateSavedJob}
          onToggleSaved={handleClick}
          isSaving={selectedJob ? savingJobIds.has(selectedJob.jobId) : false}
        />
      </div>
    </>
  );
};

export default JobTable;
