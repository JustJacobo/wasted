import { Bone, BoneRows, PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="Préstamos" back="/" backLabel="← Volver">
      <div className="grid grid-cols-2 gap-2">
        <Bone className="h-20" />
        <Bone className="h-20" />
      </div>
      <Bone className="h-11" />
      <BoneRows count={3} />
    </PageSkeleton>
  );
}
