"use client";

import { useEffect, useState } from "react";
import { WORD_DOT, WORD_PATH, WORD_VIEWBOX } from "@/components/logo";
import { formatCOP } from "@/lib/money";

const SHOW_MS = 2_600;
const EXIT_MS = 200;

/**
 * Pantalla completa "wasted." cuando un gasto pasa el 100% de lo que entró en
 * la semana. Sale una vez por semana, se cierra sola o al tocarla.
 */
export function WastedMoment({ over, onDone }: { over: number; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLeaving(true), SHOW_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(onDone, EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving, onDone]);

  return (
    <button
      type="button"
      onClick={() => setLeaving(true)}
      aria-label="Cerrar"
      className={`fixed inset-0 z-50 flex flex-col justify-center bg-foreground px-8 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-left text-background transition-opacity duration-200 ease-ui starting:opacity-0 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <svg
        viewBox={WORD_VIEWBOX}
        role="img"
        aria-label="wasted."
        className="w-full max-w-sm transition-[translate,scale] delay-75 duration-300 ease-ui starting:translate-y-2 starting:scale-[0.97] motion-reduce:starting:translate-y-0 motion-reduce:starting:scale-100"
      >
        <path d={WORD_PATH} fill="currentColor" />
        <circle cx={WORD_DOT.cx} cy={WORD_DOT.cy} r={WORD_DOT.r} className="fill-viz-over" />
      </svg>
      <p role="status" className="mt-6 text-lg leading-snug">
        Te pasaste {formatCOP(over)} esta semana.
        <span className="block opacity-60">El lunes empieza una semana nueva.</span>
      </p>
    </button>
  );
}
