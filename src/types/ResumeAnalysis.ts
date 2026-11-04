export type ResumeAnalysis = {
  ats_parseability_score: number;
  experience_years: number;
  skills: string[];
  formatting_issues: string[];
  writing_issues: {
    issue_type: string;
    description: string;
    suggestion: string;
  }[];
  suggestions: string[];
  model: string;
};

export type ResumeAnalysisState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'success'; data: ResumeAnalysis };
