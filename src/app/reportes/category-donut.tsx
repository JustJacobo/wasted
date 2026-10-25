"use client";

import { useState } from "react";
import { categoryColorVar } from "@/lib/category-colors";
import { formatCOP } from "@/lib/money";
import { compositionSegments, type CategorySlice } from "@/lib/report";

const percent = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 0 });

const formatShare = (share: number) => (share > 0 && share < 0.01 ? "<1%" : percent.format(share));

// Anillo en unidades de pathLength (100 = vuelta completa). GAP ≈ 2px de
// superficie entre segmentos al tamaño en que se dibuja.
const RADIUS = 48;
const STROKE = 16;
const GAP = 0.6;

/**
 * Composición del gasto: anillo con las categorías más grandes y el resto en
 * gris, para ver de un vistazo cómo se reparte. Tocar un segmento o su fila
 * de la leyenda muestra su valor en el centro; las barras de abajo llevan
 * todas las cifras.
 */
export function CategoryDonut({ slices }: { slices: CategorySlice[] }) {
  const segments = compositionSegments(slices);
  const total = segments.reduce((sum, s) => sum + s.amount, 0);
  const [selected, setSelected] = useState<string | null>(null);
  const shown = segments.find((s) => s.key === selected) ?? null;
  const toggle = (key: string) => setSelected((current) => (current === key ? null : key));

  const arcs = segments.map((s, i) => ({
    ...s,
    start: segments.slice(0, i).reduce((sum, prev) => sum + prev.share * 100, 0),
    length: s.share * 100,
  }));
  const single = segments.length === 1;

  return (
    <section className="border-t border-border pt-5">
      <h3 className="font-semibold">Cómo se reparte</h3>
      <div className="mt-4 flex items-center gap-5">
        <div className="relative size-36 shrink-0">
          <svg
            viewBox="0 0 120 120"
            className="size-full -rotate-90"
            role="img"
            aria-label={segments.map((s) => `${s.label} ${formatShare(s.share)}`).join(", ")}
          >
            {arcs.map((a) => (
              <circle
                key={a.key}
                cx="60"
                cy="60"
                r={RADIUS}
                fill="none"
                pathLength={100}
                stroke={categoryColorVar(a.color)}
                strokeWidth={STROKE}
                strokeDasharray={
                  single ? undefined : `${Math.max(a.length - GAP, 0.3)} ${100 - Math.max(a.length - GAP, 0.3)}`
                }
                strokeDashoffset={-a.start}
                onClick={() => toggle(a.key)}
                className={`cursor-pointer transition-opacity duration-150 ease-ui ${
                  selected && selected !== a.key ? "opacity-25" : ""
                }`}
              />
            ))}
          </svg>
          <div
            aria-live="polite"
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
          >
            <span className="max-w-full truncate text-xs text-muted">{shown ? shown.label : "Total"}</span>
            <span className="text-sm font-semibold tabular">{formatCOP(shown ? shown.amount : total)}</span>
            {shown && <span className="text-xs text-muted tabular">{formatShare(shown.share)}</span>}
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-0.5">
          {segments.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                aria-pressed={selected === s.key}
                onClick={() => toggle(s.key)}
                className={`-mx-2 flex h-8 w-[calc(100%+1rem)] items-center gap-2 rounded-lg px-2 text-left text-sm transition-opacity duration-150 ease-ui active:bg-border/40 ${
                  selected && selected !== s.key ? "opacity-40" : ""
                }`}
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: categoryColorVar(s.color) }}
                />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <span className="shrink-0 text-muted tabular">{formatShare(s.share)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
