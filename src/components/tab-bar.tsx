"use client";

import { CalendarCheck, ChartBar, House, ListBullets, Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const TABS = [
  { href: "/", label: "Inicio", Icon: House },
  { href: "/movimientos", label: "Movimientos", Icon: ListBullets },
  { href: "/plan", label: "Plan", Icon: CalendarCheck },
  { href: "/reportes", label: "Reportes", Icon: ChartBar },
] as const;

/**
 * La barra de abajo, igual que en la app: cuatro pestañas y el ＋ al centro.
 * En el inicio el ＋ abre la ventana de registro (`onAdd`); en las demás
 * pestañas lleva al inicio con la ventana abierta. `toast` va encima.
 */
export function TabBar({ onAdd, toast }: { onAdd?: () => void; toast?: ReactNode }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const tab = ({ href, label, Icon }: (typeof TABS)[number]) => {
    const on = active(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={on ? "page" : undefined}
        className={`flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-xl transition-transform duration-150 ease-ui active:scale-[0.94] ${on ? "text-foreground" : "text-muted"}`}
      >
        <Icon aria-hidden weight={on ? "fill" : "regular"} className="size-6" />
        <span className={`max-w-full truncate text-[11px] ${on ? "font-semibold" : "font-medium"}`}>{label}</span>
      </Link>
    );
  };

  const plus = "grid h-11 w-14 place-items-center rounded-2xl bg-foreground text-background transition-transform duration-150 ease-ui active:scale-[0.92]";

  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto max-w-lg px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {toast && <div className="mx-2 mb-3">{toast}</div>}
        <div className="grid grid-cols-5 items-center">
          {tab(TABS[0])}
          {tab(TABS[1])}
          <span className="flex justify-center">
            {onAdd ? (
              <button type="button" onClick={onAdd} aria-label="Registrar gasto" className={plus}>
                <Plus aria-hidden weight="bold" className="size-6" />
              </button>
            ) : (
              <Link href="/?nuevo=gasto" aria-label="Registrar gasto" className={plus}>
                <Plus aria-hidden weight="bold" className="size-6" />
              </Link>
            )}
          </span>
          {tab(TABS[2])}
          {tab(TABS[3])}
        </div>
      </div>
    </nav>
  );
}
