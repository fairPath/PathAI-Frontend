'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { File } from 'lucide-react';
import { ResumeDropdown } from './ResumeDropdown';
import { User } from '@/types/User';
import { ResumeAnalysisState } from '@/types/ResumeAnalysis';

type ResumeCardProps = {
  user: User;
};

const ResumeCard = ({ user }: ResumeCardProps) => {
  const [analysisState, setAnalysisState] = useState<ResumeAnalysisState>({ status: 'idle' });

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Resumes
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="flex items-center">
            <div className="flex items-center justify-center size-13 rounded-full bg-muted">
              <File className="size-8 text-muted-foreground" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-foreground">
                {user.resumeFileName || 'No resume uploaded'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {user.resumeUpdatedAt
                  ? `Updated at: ${new Date(user.resumeUpdatedAt).toLocaleDateString()}`
                  : 'N/A'}
              </p>
            </div>
            <div className="ml-auto">
              <ResumeDropdown onAnalysisStateChange={setAnalysisState} />
            </div>
          </div>
        </CardContent>
      </Card>

      {analysisState.status === 'loading' && (
        <Card aria-live="polite">
          <CardContent className="py-5 text-sm text-muted-foreground">
            Analyzing resume with FairPath AI…
          </CardContent>
        </Card>
      )}

      {analysisState.status === 'error' && (
        <Card role="alert">
          <CardHeader>
            <CardTitle className="text-sm">Resume analysis failed</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-destructive">{analysisState.error}</CardContent>
        </Card>
      )}

      {analysisState.status === 'success' && (
        <Card aria-live="polite">
          <CardHeader>
            <CardTitle>Resume analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  ATS parseability score
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {analysisState.data.ats_parseability_score}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Experience</p>
                <p className="mt-1 text-2xl font-semibold">
                  {analysisState.data.experience_years} years
                </p>
              </div>
            </div>

            <AnalysisList title="Skills" items={analysisState.data.skills} />
            <AnalysisList
              title="Formatting issues"
              items={analysisState.data.formatting_issues}
              emptyMessage="No formatting issues reported."
            />

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Writing issues</h3>
              {analysisState.data.writing_issues.length ? (
                <ul className="space-y-3">
                  {analysisState.data.writing_issues.map((issue, index) => (
                    <li key={`${issue.issue_type}-${index}`} className="rounded-lg border p-3">
                      <p className="font-medium">{issue.issue_type}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{issue.description}</p>
                      <p className="mt-2 text-sm">
                        <span className="font-medium">Suggestion: </span>
                        {issue.suggestion}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No writing issues reported.</p>
              )}
            </section>

            <AnalysisList title="Suggestions" items={analysisState.data.suggestions} />
            <p className="text-xs text-muted-foreground">
              Analysis model: {analysisState.data.model}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

function AnalysisList({
  title,
  items,
  emptyMessage = 'No results returned.',
}: {
  title: string;
  items: string[];
  emptyMessage?: string;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length ? (
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      )}
    </section>
  );
}

export default ResumeCard;
