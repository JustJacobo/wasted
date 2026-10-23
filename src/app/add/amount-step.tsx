"use client";

import { useEffect } from "react";
import { pressKey, type KeypadKey } from "@/lib/amount-keypad";
import { formatCOP } from "@/lib/money";
import type { TxType } from "@/lib/types";

const KEYS: KeypadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "back"];

export function AmountStep({
  type,
  onType,
  digits,
  onDigits,
  onNext,
  active,
}: {
  type: TxType;
  onType: (type: TxType) => void;
  digits: string;
  onDigits: (digits: string) => void;
  onNext: () => void;
  active: boolean;
}) {
  // Teclado físico en computador: dígitos, Backspace y Enter.
  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^[0-9]$/.test(event.key)) onDigits(pressKey(digits, event.key as KeypadKey));
      else if (event.key === "Backspace") onDigits(pressKey(digits, "back"));
      else if (event.key === "Enter" && digits) onNext();
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, digits, onDigits, onNext]);

  const amount = Number(digits || 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-background p-1 ring-1 ring-border">
        {(["expense", "income"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onType(t)}
            aria-pressed={type === t}
            className={`h-10 rounded-xl text-sm font-medium transition-colors duration-150 ${
              type === t
                ? t === "income"
                  ? "bg-accent text-background"
                  : "bg-foreground text-background"
                : "text-muted"
            }`}
          >
            {t === "expense" ? "Gasto" : "Ingreso"}
          </button>
        ))}
      </div>

      <output
        aria-label="Monto"
        className={`tabular block truncate py-2 text-center font-bold tracking-tight ${
          digits.length > 9 ? "text-4xl" : "text-5xl"
        } ${amount ? "" : "text-muted"}`}
      >
        {formatCOP(amount)}
      </output>

      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onDigits(pressKey(digits, key))}
            aria-label={key === "back" ? "Borrar" : key}
            className="tabular h-14 rounded-2xl bg-background text-2xl font-medium ring-1 ring-border transition-[transform,background-color] duration-100 ease-out active:scale-[0.97] active:bg-border/60"
          >
            {key === "back" ? "⌫" : key}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!digits}
        className="h-14 rounded-2xl bg-foreground text-lg font-semibold text-background transition-[transform,opacity] duration-150 ease-out active:scale-[0.98] disabled:opacity-30"
      >
        Siguiente
      </button>
    </div>
  );
}
