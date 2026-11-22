'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { getDeletionStatus } from './actions';

export default function AccountDeletionPage() {
  const [status, setStatus] = useState<'unavailable' | 'requested' | 'completed'>('unavailable');

  useEffect(() => {
    const token = sessionStorage.getItem('accountDeletionToken');
    if (!token) return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function check(token: string) {
      setStatus((current) => (current === 'unavailable' ? 'requested' : current));
      try {
        const result = await getDeletionStatus(token);
        if (stopped) return;
        // The token was returned only after the request committed.
        if (result === 'completed' || result === 'missing') {
          setStatus('completed');
          sessionStorage.removeItem('accountDeletionToken');
          return;
        }
      } catch {
        // A network error is not a completion signal.
      }
      if (!stopped) timer = setTimeout(() => void check(token), 5000);
    }

    timer = setTimeout(() => void check(token), 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <main className="mx-auto grid max-w-lg gap-4 px-6 py-20">
      <div role="status" className="grid gap-3">
        <h1 className="text-3xl font-semibold">
          {status === 'requested'
            ? 'Deletion requested'
            : status === 'completed'
              ? 'Deletion completed'
              : 'Account deletion'}
        </h1>
        {status === 'requested' && (
          <p>
            Your account should be deleted in about 15 minutes. We’ll email you when it’s complete.
          </p>
        )}
        {status === 'unavailable' && <p>Check your email for confirmation of account deletion.</p>}
      </div>
      <Link className="underline" href="/login">
        Return to sign in
      </Link>
    </main>
  );
}
