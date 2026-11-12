// Mirrors Spring's GET /resumes/analysis and POST /resumes/analyze bodies (snake_case).

export type AnalysisStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type Category = 'formatting' | 'parseability' | 'writing';

export type Severity = 'low' | 'medium' | 'high';

export type Scores = {
  formatting: number;
  parseability: number;
  writing: number;
  overall: number;
};

export type IssueDetail = {
  issue_id: string;
  issue_type: string;
  category: Category;
  source: 'check' | 'llm';
  severity: Severity;
  // Snippet and Line fields are all null for a document-level Issue.
  snippet: string | null;
  line_id: number | null;
  line_text: string | null;
  section: 'EXPERIENCE' | 'PROJECTS' | 'OTHER' | null;
  line_kind: 'BULLET' | 'OTHER' | null;
  description: string;
  suggestion: string;
};

export type Analysis = {
  analysis_id: string;
  status: AnalysisStatus;
  created_at: string;
  error_code: string | null;
  // null until COMPLETED
  scores: Scores | null;
  issues: IssueDetail[] | null;
  model: string | null;
  pipeline_version: string | null;
};
