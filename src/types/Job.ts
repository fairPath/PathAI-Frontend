export interface Job {
  jobId: string;
  title: string;
  companyName: string;
  dateCreated: string;
  location: string;
  redirectUrl: string;
  jobDescription: string;
  comparisonRequestId?: string | null;
  resumeId: string | null;
  resumeSnapshot: Record<string, unknown> | null;
  matchScore: number | null;
  matchedSkills: string[] | null;
  missingSkills: string[] | null;
  relevantExperience: string | null;
  otherGaps: string[] | null;
  comparisonStatus: 'NOT_REQUESTED' | 'PENDING' | 'COMPLETED' | 'FAILED' | null;
  salaryMin: number;
  salaryMax: number;
  saved: boolean;
}
