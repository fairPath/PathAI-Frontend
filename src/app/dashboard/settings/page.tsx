import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

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
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Terminate Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Warning</DialogTitle>
                <DialogDescription>
                  Deleting your account would permanently remove your saved jobs and uploaded
                  résumé. Account deletion is currently unavailable.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
