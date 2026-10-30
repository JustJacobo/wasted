"use client";

import { useState } from "react";
import {
  MAX_EVERY,
  PRESETS,
  sameFrequency,
  UNITS,
  unitName,
  type Frequency,
  type FrequencyUnit,
} from "@/lib/recurring";

const chip = (active: boolean) =>
  `rounded-full px-3 py-2 text-sm transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] ${
    active ? "bg-foreground text-background" : "bg-background ring-1 ring-border"
  }`;

/** Opciones rápidas (cada semana, cada mes…) y "Otra" para cada N días, semanas, meses o años. */
export function FrequencyPicker({
  value,
  onChange,
}: {
  value: Frequency;
  onChange: (value: Frequency) => void;
}) {
  const [custom, setCustom] = useState(!PRESETS.some((p) => sameFrequency(p.freq, value)));
  const [every, setEvery] = useState(String(value.every));

  function setCustomEvery(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, 3);
    setEvery(digits);
    const n = Number(digits);
    if (n >= 1) onChange({ every: Math.min(n, MAX_EVERY[value.unit]), unit: value.unit });
  }

  function setCustomUnit(unit: FrequencyUnit) {
    onChange({ every: Math.min(value.every, MAX_EVERY[unit]), unit });
    setEvery(String(Math.min(value.every, MAX_EVERY[unit])));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cada cuánto">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            role="radio"
            aria-checked={!custom && sameFrequency(p.freq, value)}
            onClick={() => {
              setCustom(false);
              setEvery(String(p.freq.every));
              onChange(p.freq);
            }}
            className={chip(!custom && sameFrequency(p.freq, value))}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={custom}
          onClick={() => setCustom(true)}
          className={chip(custom)}
        >
          Otra…
        </button>
      </div>

      {custom && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">Cada</span>
          <input
            aria-label="Cantidad"
            inputMode="numeric"
            enterKeyHint="done"
            value={every}
            onChange={(e) => setCustomEvery(e.target.value)}
            onBlur={() => setEvery(String(value.every))}
            className="tabular h-11 w-16 rounded-xl border border-border bg-background px-3 text-center outline-none focus:border-foreground"
          />
          <select
            aria-label="Unidad"
            value={value.unit}
            onChange={(e) => setCustomUnit(e.target.value as FrequencyUnit)}
            className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3"
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {unitName(u, value.every)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
