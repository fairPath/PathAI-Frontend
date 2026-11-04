'use client';

import { useState } from 'react';
import { Download, FilePlus, MoreHorizontalIcon, Trash } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  analyzeResume,
  confirmUpload,
  deleteResume,
  getResumeDownloadUrl,
  requestPresignUrl,
} from '@/app/dashboard/profile/action';
import { ResumeAnalysisState } from '@/types/ResumeAnalysis';
import { toast } from 'sonner';
import SubmitButton from './../ui/submitbutton';

type ResumeDropdownProps = {
  onAnalysisStateChange: (state: ResumeAnalysisState) => void;
};

export function ResumeDropdown({ onAnalysisStateChange }: ResumeDropdownProps) {
  const [showNewDialog, setShowNewDialog] = useState(false);

  async function handleDeleteResume() {
    //cud operations use actions
    const result = await deleteResume();
    if (result.ok) {
      toast.success('Resume deleted successfully');
    } else {
      toast.error(`Failed to delete resume: ${result.error}`);
    }
  }

  async function handleDownloadResume() {
    try {
      const result = await getResumeDownloadUrl();

      if (!result.ok) {
        toast.error(result.error ?? 'Failed to start resume download');
        return;
      }

      if (!result.url) {
        toast.error('Failed to start resume download');
        return;
      }

      window.open(result.url);
      toast.success('Resume download started');
    } catch (err) {
      toast.error(
        `Network error while downloading resume: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }

  async function handleUpload(formData: FormData) {
    const file = formData.get('file');

    if (!(file instanceof File)) {
      toast.error('Missing file');
      return;
    }

    const presignResult = await requestPresignUrl(formData);
    if (!presignResult.ok) {
      toast.error(`Upload failed: ${presignResult.error}`);
      return;
    }

    try {
      const uploadResponse = await fetch(presignResult.data.presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      });

      if (!uploadResponse.ok) {
        const responseBody = await uploadResponse.text();
        const errorCode = responseBody.match(/<Code>([^<]+)<\/Code>/)?.[1];
        const errorMessage = responseBody.match(/<Message>([^<]+)<\/Message>/)?.[1];
        const details = [errorCode, errorMessage].filter(Boolean).join(': ');
        toast.error(
          `Upload failed (HTTP ${uploadResponse.status})${details ? `: ${details}` : ''}`
        );
        return;
      }
    } catch (error) {
      toast.error(
        `Upload failed: ${error instanceof Error ? error.message : 'Unknown upload error'}`
      );
      return;
    }

    const confirmResult = await confirmUpload(presignResult.data.resumeId);
    if (!confirmResult.ok) {
      toast.error(`Upload failed: ${confirmResult.error}`);
      return;
    }

    setShowNewDialog(false);
    onAnalysisStateChange({ status: 'loading' });

    try {
      const analysisResult = await analyzeResume(presignResult.data.resumeId);
      if (!analysisResult.ok) {
        onAnalysisStateChange({ status: 'error', error: analysisResult.error });
        toast.error(`Resume uploaded, but analysis failed: ${analysisResult.error}`);
        return;
      }

      onAnalysisStateChange({ status: 'success', data: analysisResult.data });
      toast.success('Resume uploaded and analyzed successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not reach the AI service.';
      onAnalysisStateChange({ status: 'error', error: message });
      toast.error(`Resume uploaded, but analysis failed: ${message}`);
    }
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" aria-label="Open menu" size="icon-sm">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-40" align="end">
          <DropdownMenuLabel>File Actions</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => setShowNewDialog(true)}>
              Upload New File..
              <DropdownMenuShortcut>
                <FilePlus className="text-foreground" />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleDownloadResume}>
              Download
              <DropdownMenuShortcut>
                <Download className="text-foreground" />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleDeleteResume} variant="destructive">
              Delete
              <DropdownMenuShortcut>
                <Trash className="text-destructive" />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
          </DialogHeader>
          <form
            action={async (formData) => {
              await handleUpload(formData);
            }}
          >
            <FieldGroup className="pb-3">
              <Field>
                <FieldLabel htmlFor="file">File</FieldLabel>
                <Input name="file" id="file" type="file" accept=".pdf,application/pdf" required />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <SubmitButton message={'Uploading...'} label={'Upload'} />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
