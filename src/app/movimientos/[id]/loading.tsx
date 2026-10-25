import { Bone, PageSkeleton } from "@/components/skeleton";

// El enlace de volver depende de ?volver=, que aquí no se conoce: queda como texto.
export default function Loading() {
  return (
    <PageSkeleton className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="mt-2 space-y-6">
        <Bone className="h-12" />
        <Bone className="h-[4.75rem]" />
        <Bone className="h-[4.25rem]" />
        <div className="flex flex-wrap gap-2">
          {["w-24", "w-20", "w-28", "w-24", "w-16"].map((w, i) => (
            <Bone key={i} className={`h-9 rounded-full ${w}`} />
          ))}
        </div>
        <Bone className="h-[4.25rem]" />
        <Bone className="h-12" />
      </div>
    </PageSkeleton>
  );
}
