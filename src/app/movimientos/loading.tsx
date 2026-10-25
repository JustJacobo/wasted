import { Bone, BoneRows, PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="Historial" back="/">
      <div className="flex items-center justify-between">
        <Bone className="size-10" />
        <Bone className="h-5 w-32 rounded-md" />
        <Bone className="size-10" />
      </div>
      <Bone className="h-12" />
      <Bone className="h-12" />
      <Bone className="mx-1 h-4 w-40 rounded-md" />
      <BoneRows count={8} />
    </PageSkeleton>
  );
}
