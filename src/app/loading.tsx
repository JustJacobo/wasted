import { Bone, BoneRows } from "@/components/skeleton";

// Inicio mientras carga: el mismo marco que la página (título grande y la barra de abajo aparte).
export default function Loading() {
  return (
    <main aria-busy className="mx-auto max-w-lg px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-44">
      <p role="status" className="sr-only">
        Cargando…
      </p>
      <div className="flex min-h-12 items-center justify-between py-2">
        <Bone className="h-8 w-40 rounded-md" />
        <Bone className="size-6 rounded-full" />
      </div>
      <section className="mt-6 space-y-2">
        <Bone className="h-4 w-24 rounded-md" />
        <Bone className="h-12 w-56" />
        <Bone className="h-4 w-48 rounded-md" />
      </section>
      <div className="mt-6 space-y-2">
        <Bone className="mx-1 h-3 w-12 rounded-md" />
        <BoneRows />
      </div>
    </main>
  );
}
