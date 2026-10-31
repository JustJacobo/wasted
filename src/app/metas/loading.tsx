import { Bone, BoneRows, PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="Metas" back="/" backLabel="← Volver">
      <Bone className="h-20" />
      <BoneRows count={3} />
      <Bone className="h-11" />
    </PageSkeleton>
  );
}
