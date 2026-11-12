'use client';

import { useId, useState } from 'react';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { saveJob } from '@/app/dashboard/search-results/action';
import { Job } from '../../types/Job';

interface JobDescriptionPageProps {
  job: Job | null;
  onSaved?: (job: Job) => void;
  onToggleSaved: (job: Job) => Promise<void>;
  isSaving: boolean;
}

const JobDescription = ({ job, onSaved, onToggleSaved, isSaving }: JobDescriptionPageProps) => {
  const [isChecking, setIsChecking] = useState(false);
  const compatibilityHeadingId = useId();

  const checkCompatibility = async () => {
    if (!job || isChecking) return;
    setIsChecking(true);
    try {
      const result = await saveJob({ ...job, saved: true });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onSaved?.(result.data);
      if (result.data.comparisonStatus === 'FAILED') {
        toast.error('The compatibility check failed. Please try again.');
      } else if (result.data.comparisonStatus === 'PENDING') {
        toast.success('Comparison in progress.');
      } else if (result.data.matchScore !== null) {
        toast.success(`Resume compatibility: ${result.data.matchScore}%`);
      } else {
        toast.message('Job saved. Upload an active resume to check compatibility.');
      }
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
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={job.saved ? 'Remove saved job' : 'Save job and compare resume'}
                    aria-pressed={job.saved}
                    disabled={isSaving || isChecking}
                    onClick={() => void onToggleSaved(job)}
                  >
                    <Star className="text-purple-600" fill={job.saved ? 'currentColor' : 'none'} />
                  </Button>
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

                  {job.comparisonStatus === 'PENDING' && (
                    <p className="text-sm text-muted-foreground">
                      Comparison in progress. Your result will appear automatically.
                    </p>
                  )}
                  {job.comparisonStatus === 'FAILED' && (
                    <p className="text-sm text-destructive">
                      The comparison failed. Retry when the AI service is available.
                    </p>
                  )}
                  {(job.comparisonStatus === 'FAILED' ||
                    job.comparisonStatus === 'NOT_REQUESTED' ||
                    job.comparisonStatus === null) && (
                    <Button
                      onClick={() => void checkCompatibility()}
                      disabled={isChecking || isSaving}
                    >
                      {isChecking
                        ? 'Checking…'
                        : job.comparisonStatus === 'FAILED'
                          ? 'Retry comparison'
                          : 'Check compatibility'}
                    </Button>
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
