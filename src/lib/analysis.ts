import type { PollSchedule } from '@/lib/polling';
import { AnalysisStatus, IssueDetail, Severity } from '@/types/ResumeAnalysis';

/**
 * Analysis polling: 3 s, then 5 s, then 10 s. Times run from the server's `created_at`.
 * The hard cap must exceed the backend's pending-stale-after + processing-stale-after +
 * sweep interval (currently 10 min + 5 min + 1 min), so the client never gives up on a row
 * the server has not yet had the chance to fail.
 */
export const ANALYSIS_POLL_SCHEDULE: PollSchedule = {
  backoffMs: [3_000, 5_000, 10_000],
  softMessageAfterMs: 2 * 60_000,
  hardCapMs: 20 * 60_000,
};

export const SLOW_ANALYSIS_MESSAGE =
  'This is taking longer than usual. You can leave this page and come back; your Analysis will be here.';

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

/** Decode only the successful Spring response; shared request code handles failures. */
export function parseAnalysisResponse(value: unknown): import('@/types/ResumeAnalysis').Analysis {
  if (!value || typeof value !== 'object') throw new Error('Invalid analysis response');
  const analysis = value as import('@/types/ResumeAnalysis').Analysis;
  if (
    typeof analysis.analysis_id !== 'string' ||
    !['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'].includes(analysis.status)
  )
    throw new Error('Invalid analysis response');
  return analysis;
}
