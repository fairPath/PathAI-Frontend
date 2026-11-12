import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div>
        <Skeleton />
      </div>
    </div>
  );
}
