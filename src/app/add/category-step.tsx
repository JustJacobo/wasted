"use client";

import { useRef, useState } from "react";
import { addDays, formatShortDay, todayIn } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import type { Category, TxType } from "@/lib/types";

export function CategoryStep({
  type,
  amount,
  categories,
  date,
  onDate,
  note,
  onNote,
  selectedId,
  onSelect,
  onBack,
  onSubmit,
  pending,
  error,
}: {
  type: TxType;
  amount: number;
  categories: Category[];
  date: string;
  onDate: (date: string) => void;
  note: string;
  onNote: (note: string) => void;
  selectedId: string | null;
  onSelect: (categoryId: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
}) {
  const today = todayIn();
  const yesterday = addDays(today, -1);
  const isOther = date !== today && date !== yesterday;
  const [showNote, setShowNote] = useState(note !== "");
  const datePicker = useRef<HTMLInputElement>(null);
  const selected = categories.find((c) => c.id === selectedId);

  function openPicker() {
    const input = datePicker.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  }

  const segment = (active: boolean) =>
    `flex h-11 min-w-0 items-center justify-center gap-1 rounded-xl px-2 text-sm font-medium transition-[background-color,color,transform] duration-150 ease-ui active:scale-[0.97] ${
      active ? "bg-foreground text-background" : "text-foreground"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver al monto"
          className="grid size-10 shrink-0 place-items-center rounded-xl text-xl active:scale-[0.97]"
        >
          ←
        </button>
        <p className="tabular min-w-0 flex-1 truncate text-2xl font-bold tracking-tight">
          <span className={type === "income" ? "text-accent" : ""}>
            {type === "income" ? "+" : "-"}
            {formatCOP(amount)}
          </span>
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 px-1 text-sm text-muted">Fecha</legend>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-background p-1 ring-1 ring-border">
          <button
            type="button"
            onClick={() => onDate(today)}
            aria-pressed={date === today}
            className={segment(date === today)}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => onDate(yesterday)}
            aria-pressed={date === yesterday}
            className={segment(date === yesterday)}
          >
            Ayer
          </button>
          <button
            type="button"
            onClick={openPicker}
            aria-pressed={isOther}
            className={`relative ${segment(isOther)}`}
          >
            <span aria-hidden>📅</span>
            <span className="truncate">{isOther ? formatShortDay(date) : "Otra"}</span>
            <input
              ref={datePicker}
              type="date"
              max={today}
              value={date}
              onChange={(e) => e.target.value && onDate(e.target.value)}
              tabIndex={-1}
              aria-label="Elegir otra fecha"
              className="pointer-events-none absolute inset-0 opacity-0"
            />
          </button>
        </div>
      </fieldset>

      {showNote ? (
        <input
          autoFocus
          value={note}
          onChange={(e) => onNote(e.target.value)}
          maxLength={200}
          placeholder="Nota (opcional)"
          aria-label="Nota"
          enterKeyHint="done"
          className="h-12 rounded-2xl border border-border bg-background px-4 outline-none placeholder:text-muted focus:border-foreground"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowNote(true)}
          className="self-start rounded-lg px-1 text-sm text-muted active:scale-[0.97]"
        >
          + Nota (opcional)
        </button>
      )}

      <fieldset>
        <legend className="mb-2 px-1 text-sm text-muted">Categoría</legend>
        <div className="grid grid-cols-3 gap-2">
          {categories.map((c) => {
            const active = c.id === selectedId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                aria-pressed={active}
                className={`flex h-20 flex-col items-center justify-center gap-1 rounded-2xl px-1 transition-[background-color,color,transform,box-shadow] duration-150 ease-ui active:scale-[0.97] ${
                  active
                    ? "bg-foreground text-background ring-2 ring-foreground"
                    : "bg-background ring-1 ring-border"
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  {c.emoji}
                </span>
                <span className="w-full truncate text-center text-xs">{c.name}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={!selected || pending}
        className={`tabular sticky bottom-0 h-14 truncate rounded-2xl px-4 text-lg font-semibold text-background shadow-lg transition-[transform,opacity] duration-150 ease-ui active:scale-[0.98] disabled:opacity-30 ${
          type === "income" ? "bg-accent" : "bg-foreground"
        }`}
      >
        {pending
          ? "Guardando…"
          : selected
            ? `Agregar ${type === "income" ? "ingreso" : "gasto"} · ${selected.emoji} ${selected.name}`
            : "Elige una categoría"}
      </button>
    </div>
  );
}
