import { AnalysisStatus, IssueDetail, Severity } from '@/types/ResumeAnalysis';

/** How often the Analysis status is polled. Backoff and a client cap come later. */
export const POLL_INTERVAL_MS = 3_000;

export function isTerminal(status: AnalysisStatus): boolean {
  return status === 'COMPLETED' || status === 'FAILED';
}

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export function bySeverity(a: IssueDetail, b: IssueDetail): number {
  return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
}

export type LineGroup = { lineId: number; lineText: string; issues: IssueDetail[] };

/**
 * Splits Issues into document-level ones (no Line) and groups keyed by Line,
 * each sorted by severity. Line groups keep Resume order.
 */
export function groupIssues(issues: IssueDetail[]): {
  documentIssues: IssueDetail[];
  lineGroups: LineGroup[];
} {
  const documentIssues: IssueDetail[] = [];
  const byLine = new Map<number, LineGroup>();

  for (const issue of issues) {
    if (issue.line_id === null || issue.line_text === null) {
      documentIssues.push(issue);
      continue;
    }
    const group = byLine.get(issue.line_id) ?? {
      lineId: issue.line_id,
      lineText: issue.line_text,
      issues: [],
    };
    group.issues.push(issue);
    byLine.set(issue.line_id, group);
  }

  const lineGroups = [...byLine.values()].sort((a, b) => a.lineId - b.lineId);
  for (const group of lineGroups) group.issues.sort(bySeverity);
  return { documentIssues: documentIssues.sort(bySeverity), lineGroups };
}

/** Cuts a Line around the first occurrence of its Snippet, for highlighting. */
export function splitOnSnippet(
  lineText: string,
  snippet: string | null
): { before: string; match: string; after: string } | null {
  if (!snippet) return null;
  const start = lineText.indexOf(snippet);
  if (start === -1) return null;
  return {
    before: lineText.slice(0, start),
    match: snippet,
    after: lineText.slice(start + snippet.length),
  };
}
