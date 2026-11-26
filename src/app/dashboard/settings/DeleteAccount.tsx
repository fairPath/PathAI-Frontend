'use client';

import { useState, type FormEvent } from 'react';

import { requestAccountDeletion } from '@/app/account-deletion/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function DeleteAccount() {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const form = event.currentTarget;
    try {
      const result = await requestAccountDeletion(String(new FormData(form).get('password') ?? ''));
      if (result.ok) {
        try {
          sessionStorage.removeItem('accountDeletionCompleted');
          if (result.data.token) {
            sessionStorage.setItem('accountDeletionToken', result.data.token);
          } else {
            // ACCOUNT_UNAVAILABLE: drop any leftover receipt so the status page doesn't poll it.
            sessionStorage.removeItem('accountDeletionToken');
          }
        } finally {
          window.location.replace('/account-deletion');
        }
        return;
      }
      setError(result.error);
    } catch {
      setError('Could not request account deletion. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog onOpenChange={() => setError('')}>
      <DialogTrigger asChild>
        <Button variant="outline">Delete account</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            This permanently deletes your account, résumé, analyses, saved jobs, comparisons, and
            usage records. You’ll be signed out once the request is saved.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={confirm} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="deletion-password">Current password</Label>
            <Input
              id="deletion-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p role="alert">{error}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Requesting deletion…' : 'Permanently delete account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
