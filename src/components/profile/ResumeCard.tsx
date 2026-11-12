import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { File } from 'lucide-react';
import { ResumeDropdown } from './ResumeDropdown';
import { AnalysisPanel } from './AnalysisPanel';
import { User } from '@/types/User';
import { ActionResult } from '@/types/action-result';
import { Analysis } from '@/types/ResumeAnalysis';

type ResumeCardProps = {
  user: User;
  latestAnalysis: ActionResult<Analysis | null>;
};

const ResumeCard = ({ user, latestAnalysis }: ResumeCardProps) => {
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
              <ResumeDropdown />
            </div>
          </div>
        </CardContent>
      </Card>

      <AnalysisPanel hasResume={Boolean(user.resumeId)} initialAnalysis={latestAnalysis} />
    </div>
  );
};

export default ResumeCard;
