import { Bone, BoneRows, PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="Plan" className="space-y-4 pb-32">
      <Bone className="mx-1 h-4 w-44 rounded-md" />
      <Bone className="h-28" />
      <BoneRows count={5} />
      <Bone className="mx-1 h-4 w-24 rounded-md" />
      <Bone className="h-14" />
    </PageSkeleton>
  );
}
