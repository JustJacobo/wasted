"use client";

import { useEffect, useState, useTransition } from "react";
import { ACCENTS, type Accent } from "@/lib/theme";
import { setAccent } from "./actions";

/** Muestras del tema de acento. Se aplica al tocar, antes de que responda el servidor. */
export function AccentPicker({ initial }: { initial: Accent }) {
  const [accent, setLocal] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  function choose(next: Accent) {
    if (next === accent) return;
    const previous = accent;
    setLocal(next);
    setError(null);
    startTransition(async () => {
      const result = await setAccent(next);
      if (result.error) {
        setLocal(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-2xl bg-surface px-4 py-4 ring-1 ring-border">
      <div role="radiogroup" aria-label="Tema de acento" className="flex justify-between gap-2">
        {ACCENTS.map((a) => {
          const active = a.key === accent;
          return (
            <button
              key={a.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(a.key)}
              className="flex min-w-0 flex-1 flex-col items-center gap-2 text-xs transition-transform duration-150 ease-ui active:scale-[0.96]"
            >
              <span
                aria-hidden
                style={{ "--sw-l": a.swatch.light, "--sw-d": a.swatch.dark } as React.CSSProperties}
                className={`grid size-10 place-items-center rounded-full ring-offset-2 ring-offset-surface transition-shadow duration-150 bg-(--sw-l) dark:bg-(--sw-d) ${
                  active ? "ring-2 ring-foreground" : "ring-1 ring-border"
                }`}
              />
              <span className={active ? "text-foreground" : "text-muted"}>{a.name}</span>
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
