"use client";

import { useEffect, useState, useTransition } from "react";
import { ACCENTS, COLOR_MODES, type Accent, type ColorMode } from "@/lib/theme";
import { applyMode } from "@/lib/theme-client";
import { setAccent, setColorMode } from "./actions";

/**
 * Modo (sistema, claro u oscuro) y color de acento. Todo se aplica al tocar,
 * antes de que responda el servidor; si falla, vuelve a lo anterior.
 */
export function ThemePicker({
  initialAccent,
  initialMode,
}: {
  initialAccent: Accent;
  initialMode: ColorMode;
}) {
  const [accent, setAccentLocal] = useState(initialAccent);
  const [mode, setModeLocal] = useState(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  function save<T>(next: T, previous: T, setLocal: (value: T) => void, action: () => Promise<{ error?: string }>) {
    if (next === previous) return;
    setLocal(next);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setLocal(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-4 rounded-xl bg-surface px-4 py-4 ring-1 ring-border">
      <div role="radiogroup" aria-label="Modo" className="grid grid-cols-3 gap-1 rounded-xl bg-background p-1 ring-1 ring-border">
        {COLOR_MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={m.key === mode}
            onClick={() => save(m.key, mode, setModeLocal, () => setColorMode(m.key))}
            className={`h-9 rounded-lg text-sm font-medium transition-colors duration-150 ease-ui ${
              m.key === mode ? "bg-foreground text-background" : "text-muted"
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>

      <div role="radiogroup" aria-label="Color de acento" className="flex justify-between gap-2">
        {ACCENTS.map((a) => {
          const active = a.key === accent;
          return (
            <button
              key={a.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => save(a.key, accent, setAccentLocal, () => setAccent(a.key))}
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
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
