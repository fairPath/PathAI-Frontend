'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { getLatestAnalysis, startAnalysis } from '@/app/dashboard/profile/action';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { groupIssues, isTerminal, POLL_INTERVAL_MS, splitOnSnippet } from '@/lib/analysis';
import { ActionResult } from '@/types/action-result';
import { Analysis, IssueDetail, Scores } from '@/types/ResumeAnalysis';

const DISCLOSURE =
  'Analyze sends your resume, with personal details removed, to OpenAI for review.';

type PanelState =
  | { kind: 'none' }
  | { kind: 'analysis'; analysis: Analysis }
  | { kind: 'error'; message: string };

type AnalysisPanelProps = {
  hasResume: boolean;
  // The latest Analysis, loaded on the server with the page.
  initialAnalysis: ActionResult<Analysis | null>;
};

function toPanelState(result: ActionResult<Analysis | null>): PanelState {
  if (!result.ok) return { kind: 'error', message: result.error };
  if (result.data === null) return { kind: 'none' };
  return { kind: 'analysis', analysis: result.data };
}

export function AnalysisPanel({ hasResume, initialAnalysis }: AnalysisPanelProps) {
  // A still-running Analysis picks up polling straight away.
  const [state, setState] = useState<PanelState>(() => toPanelState(initialAnalysis));
  const [starting, setStarting] = useState(false);

  const refresh = useCallback(async () => {
    setState(toPanelState(await getLatestAnalysis()));
  }, []);

  // Poll until the Analysis reaches a terminal status: each poll result is a
  // new state, which schedules the next poll.
  useEffect(() => {
    if (state.kind !== 'analysis' || isTerminal(state.analysis.status)) return;
    const timer = setTimeout(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [state, refresh]);

  async function handleAnalyze() {
    setStarting(true);
    const result = await startAnalysis();
    setStarting(false);
    setState(toPanelState(result));
  }

  const running = state.kind === 'analysis' && !isTerminal(state.analysis.status);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resume analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Button onClick={handleAnalyze} disabled={!hasResume || starting || running}>
            {(starting || running) && <Loader2 className="animate-spin" />}
            Analyze
          </Button>
          <p className="text-xs text-muted-foreground">{DISCLOSURE}</p>
        </div>

        {!hasResume && (
          <p className="text-sm text-muted-foreground">Upload a resume to analyze it.</p>
        )}

        {state.kind === 'error' && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}

        {state.kind === 'analysis' && (
          <AnalysisView analysis={state.analysis} onRetry={handleAnalyze} retrying={starting} />
        )}
      </CardContent>
    </Card>
  );
}

function AnalysisView({
  analysis,
  onRetry,
  retrying,
}: {
  analysis: Analysis;
  onRetry: () => void;
  retrying: boolean;
}) {
  if (!isTerminal(analysis.status)) {
    return (
      <p aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Analyzing your resume…
      </p>
    );
  }

  if (analysis.status === 'FAILED') {
    return (
      <div role="alert" className="flex items-center gap-4">
        <p className="text-sm text-destructive">Analysis didn&apos;t finish.</p>
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div aria-live="polite" className="space-y-5">
      {analysis.scores && <ScoreGrid scores={analysis.scores} />}
      <IssueList issues={analysis.issues ?? []} />
    </div>
  );
}

function ScoreGrid({ scores }: { scores: Scores }) {
  const tiles: [string, number][] = [
    ['Overall', scores.overall],
    ['Formatting', scores.formatting],
    ['Parseability', scores.parseability],
    ['Writing', scores.writing],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-muted p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
      ))}
    </div>
  );
}

function IssueList({ issues }: { issues: IssueDetail[] }) {
  if (issues.length === 0) {
    return <p className="text-sm text-muted-foreground">No issues found.</p>;
  }
  const { documentIssues, lineGroups } = groupIssues(issues);

  return (
    <div className="space-y-5">
      {documentIssues.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Whole resume</h3>
          <ul className="space-y-3">
            {documentIssues.map((issue) => (
              <IssueItem key={issue.issue_id} issue={issue} />
            ))}
          </ul>
        </section>
      )}

      {lineGroups.map((group) => (
        <section key={group.lineId} className="space-y-2">
          <LineText lineText={group.lineText} snippet={group.issues[0]?.snippet ?? null} />
          <ul className="space-y-3">
            {group.issues.map((issue) => (
              <IssueItem key={issue.issue_id} issue={issue} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function LineText({ lineText, snippet }: { lineText: string; snippet: string | null }) {
  const parts = splitOnSnippet(lineText, snippet);
  return (
    <p className="rounded-md bg-muted px-3 py-2 text-sm">
      {parts ? (
        <>
          {parts.before}
          <mark className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-800">{parts.match}</mark>
          {parts.after}
        </>
      ) : (
        lineText
      )}
    </p>
  );
}

const SEVERITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' } as const;

function IssueItem({ issue }: { issue: IssueDetail }) {
  return (
    <li className="rounded-lg border p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">
        {SEVERITY_LABEL[issue.severity]} · {issue.category}
      </p>
      <p className="mt-1 text-sm">{issue.description}</p>
      <p className="mt-2 text-sm">
        <span className="font-medium">Suggestion: </span>
        {issue.suggestion}
      </p>
    </li>
  );
}
