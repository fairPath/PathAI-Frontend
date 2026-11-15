'use client';

import { useId, useState } from 'react';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { requestJobComparison } from '@/app/dashboard/search-results/action';
import { comparisonButtonState, comparisonErrorMessage } from '@/lib/job-comparison';
import { Job } from '../../types/Job';

interface JobDescriptionPageProps {
  job: Job | null;
  currentResumeId: string | null;
  enableComparison?: boolean;
  onSaved?: (job: Job) => void;
  onToggleSaved: (job: Job) => Promise<void>;
  isSaving: boolean;
  comparisonBlocked?: boolean;
  requestError?: { code: string; retryable: boolean };
  onComparisonError?: (jobId: string, code: string, retryable: boolean) => void;
}

const JobDescription = ({
  job,
  currentResumeId,
  onSaved,
  onToggleSaved,
  isSaving,
  enableComparison = false,
  comparisonBlocked = false,
  requestError,
  onComparisonError,
}: JobDescriptionPageProps) => {
  const [isChecking, setIsChecking] = useState(false);
  const compatibilityHeadingId = useId();
  const blocked = comparisonBlocked || requestError?.retryable === false;
  const button = job
    ? comparisonButtonState(job, Boolean(currentResumeId), blocked, isChecking || isSaving)
    : null;
  const capturedAt = job?.comparisonCompletedAt;
  const comparisonDate = typeof capturedAt === 'string' ? new Date(capturedAt) : null;
  const comparisonDateLabel =
    comparisonDate && !Number.isNaN(comparisonDate.getTime())
      ? new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        })
          .format(comparisonDate)
          .replace(/^([A-Za-z]{3}) /, '$1. ')
      : null;

  const checkCompatibility = async () => {
    if (!enableComparison || !job || isChecking) return;
    setIsChecking(true);
    try {
      const result = await requestJobComparison(job.jobId);
      if (!result.ok) {
        onComparisonError?.(job.jobId, result.errorCode, result.retryable);
        return;
      }
      onSaved?.(result.data);
      toast.success('Match check requested.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <>
      {!job && (
        <div className="flex justify-center items-center">
          <p className="text-lg font-semibold">no job to display...</p>
        </div>
      )}
      {job && (
        <div className="max-w-6xl mx-auto pl-2">
          <Card className="shadow-md">
            <CardContent className="space-y-8">
              <div className="sticky top-0 z-10 bg-white pt-4 pb-3 border-b">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-2xl font-semibold">{job.title}</h1>
                  {job.saved && enableComparison ? (
                    <div className="max-w-64 shrink-0 space-y-2 text-right">
                      <Button disabled={button!.disabled} onClick={() => void checkCompatibility()}>
                        {button!.label}
                      </Button>
                      {(requestError || job.comparisonStatus === 'FAILED') && (
                        <p role="alert" className="text-xs text-destructive">
                          {comparisonErrorMessage(requestError?.code ?? job.comparisonErrorCode)}
                          {blocked && ' Refresh the page to enable another attempt.'}
                        </p>
                      )}
                      {!currentResumeId && (
                        <p className="text-xs text-muted-foreground">
                          Upload an active resume to check your match.
                        </p>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={job.saved ? 'Remove saved job' : 'Save job'}
                      aria-pressed={job.saved}
                      disabled={isSaving}
                      onClick={() => void onToggleSaved(job)}
                    >
                      <Star
                        className="text-purple-600"
                        fill={job.saved ? 'currentColor' : 'none'}
                      />
                    </Button>
                  )}
                </div>
                <p className="text-muted-foreground">{job.companyName}</p>

                <div className="flex flex-row gap-2">
                  <div className="flex flex-col">
                    <p className="text-sm text-muted-foreground">
                      Posted on{' '}
                      {new Intl.DateTimeFormat('en-US', {
                        dateStyle: 'full',
                      }).format(new Date(job.dateCreated))}
                    </p>
                    <p className="text-sm text-muted-foreground">{job.location}</p>
                  </div>

                  <div className="flex justify-end flex-grow">
                    <Button className=" bg-purple-600 hover:bg-blue-600" asChild>
                      <a href={job.redirectUrl} target="_blank" rel="noopener noreferrer">
                        Apply on Adzuna
                      </a>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <p className="text-base whitespace-pre-line">{job.jobDescription}</p>
              </div>

              {job.saved && (
                <section
                  className="rounded-lg border bg-purple-50 p-4 space-y-4"
                  aria-labelledby={compatibilityHeadingId}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 id={compatibilityHeadingId} className="text-lg font-semibold">
                      Resume compatibility
                    </h2>
                    {job.matchScore !== null && (
                      <span className="rounded-full bg-purple-700 px-3 py-1 text-sm font-semibold text-white">
                        {job.matchScore}% match
                      </span>
                    )}
                  </div>

                  {job.comparisonStatus === 'COMPLETED' && (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <h3 className="font-medium">Matched skills</h3>
                          <p className="text-sm text-muted-foreground">
                            {job.matchedSkills?.length
                              ? job.matchedSkills.join(', ')
                              : 'No matched skills returned.'}
                          </p>
                        </div>
                        <div>
                          <h3 className="font-medium">Missing skills</h3>
                          <p className="text-sm text-muted-foreground">
                            {job.missingSkills?.length
                              ? job.missingSkills.join(', ')
                              : 'No missing skills identified.'}
                          </p>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-medium">Relevant experience</h3>
                        <p className="whitespace-pre-line text-sm text-muted-foreground">
                          {job.relevantExperience || 'No relevant experience details returned.'}
                        </p>
                      </div>
                      <div>
                        <h3 className="font-medium">Other gaps</h3>
                        <p className="text-sm text-muted-foreground">
                          {job.otherGaps?.length
                            ? job.otherGaps.join(', ')
                            : 'No other gaps identified.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {(!job.comparisonStatus || job.comparisonStatus === 'NOT_REQUESTED') && (
                    <p className="text-sm text-muted-foreground">
                      {enableComparison
                        ? 'Select Check match to compare this job with your latest active resume.'
                        : 'Open Saved Jobs to check this job against your latest active resume.'}
                    </p>
                  )}
                  {job.comparisonStatus === 'PENDING' && (
                    <p className="text-sm text-muted-foreground">
                      Comparison in progress. Your result will appear automatically.
                    </p>
                  )}
                  {job.comparisonStatus === 'COMPLETED' && comparisonDateLabel && (
                    <p className="text-sm text-muted-foreground">
                      Match checked{' '}
                      <time dateTime={comparisonDate!.toISOString()}>{comparisonDateLabel}</time>
                    </p>
                  )}
                </section>
              )}

              <div className="pt-4 space-y-1">
                <div className="flex flex-row justify-between">
                  <p className="text-lg font-medium">Salary</p>
                </div>

                <p>
                  {job.salaryMin === job.salaryMax
                    ? `$${job.salaryMin.toLocaleString()}`
                    : `$${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}`}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default JobDescription;
