import { Bone, BoneRows, PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="Categorías" back="/ajustes" backLabel="← Ajustes">
      <Bone className="h-12" />
      <Bone className="mx-1 h-10" />
      <BoneRows count={8} />
    </PageSkeleton>
  );
}
