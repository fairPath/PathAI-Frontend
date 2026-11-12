import { User } from '@/types/User';
import { ActionResult } from '@/types/action-result';
import { Analysis } from '@/types/ResumeAnalysis';
import { MailIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import ResumeCard from './ResumeCard';

type ProfileProps = {
  user: User;
  latestAnalysis: ActionResult<Analysis | null>;
};
const Profile = ({ user, latestAnalysis }: ProfileProps) => {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10 ">
      <div className="space-y-6">
        <div className="flex items-center justify-center gap-5">
          <div className="text-4xl font-semibold text-foreground">
            Welcome {user.firstName} {user.lastName}!
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Account Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 ">
              <div className="flex items-center gap-3">
                <MailIcon className="size-4" />
                <span>{user.email}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <ResumeCard user={user} latestAnalysis={latestAnalysis} />
      </div>
    </div>
  );
};

export default Profile;
