"use client";

import { useEffect, useState } from "react";

/** Valor para pegar en otra app (URL, clave, script) con su botón de copiar. */
export function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1_500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles: el valor queda seleccionable para copiarlo a mano.
    }
  }

  return (
    <div className="rounded-xl bg-surface ring-1 ring-border">
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <span className="text-xs text-muted">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-accent-ink active:scale-[0.97]"
        >
          <span aria-live="polite">{copied ? "Copiado" : "Copiar"}</span>
        </button>
      </div>
      <pre
        className={`px-4 pb-3 font-mono text-sm break-all whitespace-pre-wrap select-all ${
          multiline ? "max-h-64 overflow-y-auto text-xs" : ""
        }`}
      >
        {value}
      </pre>
    </div>
  );
}
