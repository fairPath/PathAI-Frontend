'use client';

import { useState } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { getDailyJobMatch, setDailyJobMatch } from './actions';

export default function DailyJobMatch({
  preference,
}: {
  preference: Awaited<ReturnType<typeof getDailyJobMatch>>;
}) {
  const [enabled, setEnabled] = useState(preference.ok && preference.data.enabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(preference.ok ? '' : preference.error);

  async function update(next: boolean) {
    setPending(true);
    setError('');
    try {
      const result = await setDailyJobMatch(next);
      if (result.ok) setEnabled(result.data.enabled);
      else setError(result.error);
    } catch {
      setError('Could not save Daily Job Match. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <Label htmlFor="daily-job-match">Daily Job Match</Label>
          <p id="daily-job-match-description" className="text-sm text-muted-foreground">
            Get a demo email with sample jobs when you turn this on, then daily at 9:00 a.m.
            Eastern. You can turn it off anytime.
          </p>
          {preference.ok && (
            <p role="status" className="text-sm text-muted-foreground">
              {pending ? 'Saving…' : `Daily Job Match is ${enabled ? 'on' : 'off'}.`}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <Switch
          id="daily-job-match"
          aria-describedby="daily-job-match-description"
          checked={enabled}
          disabled={!preference.ok || pending}
          onCheckedChange={update}
        />
      </CardContent>
    </Card>
  );
}
