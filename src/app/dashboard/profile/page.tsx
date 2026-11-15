import Profile from '@/components/profile/Profile';
import { serverApiFetch } from '@/lib/server-api-client';
import { User } from '@/types/User';
import { getLatestAnalysis } from './action';

export default async function page() {
  const [user, latestAnalysis] = await Promise.all([
    serverApiFetch<User>('/users/me', { method: 'GET' }),
    getLatestAnalysis(),
  ]);
  return (
    <div>
      <Profile user={user} latestAnalysis={latestAnalysis} />
    </div>
  );
}
