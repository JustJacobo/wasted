import { Bone, PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <PageSkeleton back="/" className="space-y-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {["h-16", "h-14", "h-28", "h-20", "h-20"].map((h, i) => (
        <section key={i} className="space-y-2">
          <Bone className="mx-1 h-3.5 w-24 rounded-md" />
          <Bone className={h} />
        </section>
      ))}
    </PageSkeleton>
  );
}
