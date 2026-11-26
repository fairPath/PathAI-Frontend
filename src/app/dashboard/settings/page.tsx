import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { getDailyJobMatch } from './actions';
import DailyJobMatch from './DailyJobMatch';
import DeleteAccount from './DeleteAccount';

export default async function SettingsPage() {
  const preference = await getDailyJobMatch();
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <h1 className="text-4xl font-semibold">Settings</h1>

      <DailyJobMatch preference={preference} />

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
