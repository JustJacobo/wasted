import { Bone, BoneRows } from "@/components/skeleton";

// Inicio mientras carga: el mismo marco que HomePager (pestañas fijas arriba).
export default function Loading() {
  return (
    <div aria-busy>
      <header className="fixed inset-x-0 top-0 z-10 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4">
          <div className="flex">
            <span className="flex h-12 w-28 items-center text-lg font-bold tracking-tight">Inicio</span>
            <span className="flex h-12 w-28 items-center text-lg font-bold tracking-tight text-muted">
              Dashboard
            </span>
          </div>
          <Bone className="size-6 rounded-full" />
        </div>
      </header>
      <div className="mx-auto max-w-lg px-4 pt-[calc(env(safe-area-inset-top)+3.75rem)] pb-44">
        <p role="status" className="sr-only">
          Cargando…
        </p>
        <Bone className="mx-1 mb-2 h-4 w-28 rounded-md" />
        <section className="mt-6 space-y-2">
          <Bone className="h-4 w-40 rounded-md" />
          <Bone className="h-12 w-56" />
          <Bone className="h-4 w-48 rounded-md" />
        </section>
        <div className="mt-6 space-y-2">
          <Bone className="mx-1 h-3 w-12 rounded-md" />
          <BoneRows />
        </div>
      </div>
    </div>
  );
}
