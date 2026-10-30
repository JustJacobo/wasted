"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatShortDay } from "@/lib/dates";
import { frequencyLabel, type Frequency, type Recurring } from "@/lib/recurring";
import { makeRecurring } from "../../ajustes/recurrentes/actions";
import { FrequencyPicker } from "../../ajustes/recurrentes/frequency-picker";

/** "Repetir": convierte el movimiento en recurrente, o muestra cada cuánto se repite. */
export function RepeatSection({
  transactionId,
  occurredOn,
  rule,
  today,
}: {
  transactionId: string;
  occurredOn: string;
  rule: Recurring | null;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [freq, setFreq] = useState<Frequency>({ every: 1, unit: "month" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const result = await makeRecurring(transactionId, freq);
      if (result.error) setError(result.error);
      else setOpen(false);
    });
  }

  return (
    <div>
      <span className="mb-1 block px-1 text-sm text-muted">Repetir</span>
      {rule ? (
        <Link
          href="/ajustes/recurrentes"
          className="flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 ring-1 ring-border active:scale-[0.99]"
        >
          <span className="min-w-0">
            <span className="block truncate">{frequencyLabel(rule.starts_on, rule)}</span>
            <span className="block truncate text-xs text-muted">
              {rule.paused
                ? "Pausado"
                : `Próximo: ${rule.next_on === today ? "hoy" : formatShortDay(rule.next_on)}`}
            </span>
          </span>
          <span className="shrink-0 text-sm text-muted">Editar ›</span>
        </Link>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-12 w-full items-center justify-between rounded-xl bg-surface px-4 ring-1 ring-border transition-transform duration-150 ease-out active:scale-[0.99]"
        >
          <span>No se repite</span>
          <span aria-hidden className="text-muted">
            ›
          </span>
        </button>
      ) : (
        <div className="space-y-3 rounded-xl bg-surface p-3 ring-1 ring-border">
          <FrequencyPicker value={freq} onChange={setFreq} />
          <p className="px-1 text-xs text-muted">
            {frequencyLabel(occurredOn, freq)}. Cuando llegue la fecha aparece en Por revisar con lo
            guardado de este movimiento.
          </p>
          {error && (
            <p role="alert" className="px-1 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-11 flex-1 rounded-xl text-sm font-medium text-muted active:scale-[0.98]"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className="h-11 flex-1 rounded-xl bg-foreground text-sm font-semibold text-background transition-[transform,opacity] duration-150 ease-ui active:scale-[0.98] disabled:opacity-30"
            >
              {pending ? "Guardando…" : "Repetir"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
