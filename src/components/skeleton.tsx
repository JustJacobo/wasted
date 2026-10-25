import Link from "next/link";

// Piezas de las pantallas de carga (`loading.tsx`). Repiten el marco de cada
// página (mismo <main> y encabezado) para que al llegar los datos nada salte.

/** Bloque gris en el lugar de un dato. */
export function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-xl bg-border/70 ${className}`} />;
}

/** Filas como las del historial: ícono, dos líneas y monto. */
export function BoneRows({ count = 6 }: { count?: number }) {
  return (
    <ul aria-hidden className="divide-y divide-border border-y border-border">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-3 py-3">
          <Bone className="size-5 shrink-0 rounded-full" />
          <span className="min-w-0 flex-1 space-y-1.5">
            <Bone className={`h-3.5 rounded-md ${i % 3 === 0 ? "w-2/5" : i % 3 === 1 ? "w-3/5" : "w-1/2"}`} />
            <Bone className="h-3 w-1/4 rounded-md" />
          </span>
          <Bone className="h-3.5 w-16 shrink-0 rounded-md" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Marco de una página secundaria mientras carga. `back` es un enlace real, así
 * se puede volver sin esperar; sin `back`, el texto queda solo como referencia.
 */
export function PageSkeleton({
  title,
  back,
  backLabel = "← Volver",
  className = "space-y-4 pb-[max(2rem,env(safe-area-inset-bottom))]",
  children,
}: {
  title?: string;
  back?: string;
  backLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <main
      aria-busy
      className={`mx-auto max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))] ${className}`}
    >
      <header className="flex items-center gap-2 py-2">
        {back ? (
          <Link href={back} className="rounded-lg px-2 py-1 text-sm text-muted active:scale-[0.97]">
            {backLabel}
          </Link>
        ) : (
          <span className="px-2 py-1 text-sm text-muted">{backLabel}</span>
        )}
        {title && <h1 className="flex-1 text-right text-lg font-bold tracking-tight">{title}</h1>}
      </header>
      <p role="status" className="sr-only">
        Cargando…
      </p>
      {children}
    </main>
  );
}
