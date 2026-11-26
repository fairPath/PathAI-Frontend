'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { getDeletionStatus } from './actions';

export default function AccountDeletionPage() {
  const [status, setStatus] = useState<'unavailable' | 'requested' | 'completed'>('unavailable');

  useEffect(() => {
    const token = sessionStorage.getItem('accountDeletionToken');
    if (!token && sessionStorage.getItem('accountDeletionCompleted') !== 'true') return;

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
          sessionStorage.setItem('accountDeletionCompleted', 'true');
          sessionStorage.removeItem('accountDeletionToken');
          return;
        }
      } catch {
        // A network error is not a completion signal.
      }
      if (!stopped) timer = setTimeout(() => void check(token), 5000);
    }

    timer = setTimeout(() => {
      if (token) {
        void check(token);
      } else {
        setStatus('completed');
      }
    }, 0);
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
            Your account is being deleted. This usually takes under a minute, or up to 15 minutes if
            you recently started a résumé upload.
          </p>
        )}
        {status === 'completed' && <p>Your account and all its data have been deleted.</p>}
        {status === 'unavailable' && (
          <p>Your account is being deleted. You may receive a confirmation email.</p>
        )}
      </div>
      <Link className="underline" href="/login">
        Return to sign in
      </Link>
    </main>
  );
}
