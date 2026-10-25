import { Bone, BoneRows, PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="Por revisar" back="/">
      <Bone className="mx-1 h-10" />
      <BoneRows count={4} />
    </PageSkeleton>
  );
}
