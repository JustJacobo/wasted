import { Bone, PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="Reportes" className="space-y-4 pb-32">
      <Bone className="h-12" />
      <Bone className="mx-auto h-10 w-48 rounded-md" />
      <Bone className="h-4 w-24 rounded-md" />
      <Bone className="h-14 w-60" />
      <Bone className="h-40" />
    </PageSkeleton>
  );
}
