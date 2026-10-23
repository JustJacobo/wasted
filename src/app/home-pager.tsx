"use client";

import Link from "next/link";
import {
  createContext,
  use,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const TABS = ["Inicio", "Dashboard"] as const;

const PagerContext = createContext<(index: number) => void>(() => {});

/** Lleva a otro panel desde cualquier componente dentro del paginador. */
export function GoToPanel({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: ReactNode;
}) {
  const goTo = use(PagerContext);
  return (
    <button type="button" onClick={() => goTo(index)} className={className}>
      {children}
    </button>
  );
}

/**
 * Inicio y Dashboard lado a lado: se pasa de uno a otro deslizando (scroll-snap
 * nativo, con su inercia) o tocando las pestañas. La línea bajo las pestañas
 * sigue al dedo; se mueve con `transform` en cada frame, sin transición.
 */
export function HomePager({
  initialPanel,
  home,
  dashboard,
}: {
  initialPanel: 0 | 1;
  home: ReactNode;
  dashboard: ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState<0 | 1>(initialPanel);
  const firstPanel = useRef(initialPanel);

  // Si se entra directo al dashboard, colocarlo antes del primer pintado.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && firstPanel.current === 1) el.scrollLeft = el.clientWidth;
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const progress = el.clientWidth ? el.scrollLeft / el.clientWidth : 0;
      if (indicator.current) {
        indicator.current.style.transform = `translateX(${progress * 100}%)`;
      }
      const next = progress > 0.5 ? 1 : 0;
      setActive((current) => (current === next ? current : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    el.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  function goTo(index: number) {
    const el = scroller.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: index * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <PagerContext value={goTo}>
      <header className="fixed inset-x-0 top-0 z-10 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4">
          <div role="tablist" aria-label="Secciones" className="relative flex">
            {TABS.map((label, i) => (
              <button
                key={label}
                id={`tab-${i}`}
                type="button"
                role="tab"
                aria-selected={active === i}
                aria-controls={`panel-${i}`}
                onClick={() => goTo(i)}
                className={`h-12 w-28 text-left text-lg font-bold tracking-tight transition-colors duration-150 ease-ui ${
                  active === i ? "text-foreground" : "text-muted"
                }`}
              >
                {label}
              </button>
            ))}
            <span
              ref={indicator}
              aria-hidden
              className="pointer-events-none absolute bottom-1.5 left-0 h-0.5 w-28 pr-6"
            >
              <span className="block h-full w-full rounded-full bg-foreground" />
            </span>
          </div>
          <Link
            href="/ajustes"
            aria-label="Ajustes"
            className="grid size-9 place-items-center rounded-xl text-muted active:scale-[0.97]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
              <path
                d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </header>

      <div
        ref={scroller}
        // `relative` en el contenedor y los paneles: sin él, los elementos
        // absolutos (p. ej. textos sr-only) escapan del recorte y ensanchan la
        // página en el celular.
        className="relative flex h-dvh snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {[home, dashboard].map((content, i) => (
          <section
            key={TABS[i]}
            id={`panel-${i}`}
            role="tabpanel"
            aria-labelledby={`tab-${i}`}
            inert={active !== i}
            className="relative h-full w-full shrink-0 snap-start snap-always overflow-y-auto overscroll-y-contain"
          >
            <div className="mx-auto max-w-lg px-4 pt-[calc(env(safe-area-inset-top)+3.75rem)] pb-44">
              {content}
            </div>
          </section>
        ))}
      </div>
    </PagerContext>
  );
}
