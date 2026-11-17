import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Encabezado de página, igual que en la app. Las pestañas (Inicio,
 * Movimientos, Plan, Reportes) llevan el título grande; las demás, la flecha
 * hacia `back` y el título al lado.
 */
export function ScreenHeader({ title, back, action }: { title: string; back?: string; action?: ReactNode }) {
  if (!back) {
    return (
      <header className="flex min-h-12 items-center gap-2 py-2">
        <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">{title}</h1>
        {action}
      </header>
    );
  }
  return (
    <header className="-ml-2 flex min-h-12 items-center gap-1 py-2">
      <Link href={back} aria-label="Volver" className="grid size-11 shrink-0 place-items-center rounded-xl active:scale-[0.97]">
        <CaretLeft aria-hidden className="size-6" />
      </Link>
      <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">{title}</h1>
      {action}
    </header>
  );
}
