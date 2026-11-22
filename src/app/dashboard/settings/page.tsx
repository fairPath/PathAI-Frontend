import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import DeleteAccount from './DeleteAccount';

export default function SettingsPage() {
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <h1 className="text-4xl font-semibold">Settings</h1>

      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="grid gap-1">
            <Label htmlFor="daily-job-match">Daily Job Match</Label>
            <p id="daily-job-match-status" className="text-sm text-muted-foreground">
              Coming soon
            </p>
          </div>
          <Switch
            id="daily-job-match"
            aria-describedby="daily-job-match-status"
            checked={false}
            disabled
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <DeleteAccount />
        </CardContent>
      </Card>
    </div>
  );
}
