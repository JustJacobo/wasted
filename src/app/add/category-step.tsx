"use client";

import { useState } from "react";
import { addDays, formatDay, todayIn } from "@/lib/dates";
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
  onBack,
  onPick,
  pendingId,
  error,
}: {
  type: TxType;
  amount: number;
  categories: Category[];
  date: string;
  onDate: (date: string) => void;
  note: string;
  onNote: (note: string) => void;
  onBack: () => void;
  onPick: (categoryId: string) => void;
  pendingId: string | null;
  error: string | null;
}) {
  const today = todayIn();
  const [showDates, setShowDates] = useState(false);
  const [showNote, setShowNote] = useState(note !== "");

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
        <button
          type="button"
          onClick={() => setShowDates((v) => !v)}
          aria-expanded={showDates}
          className="shrink-0 rounded-full bg-background px-3 py-1.5 text-sm ring-1 ring-border active:scale-[0.97]"
        >
          {formatDay(date, today)} ▾
        </button>
      </div>

      {showDates && (
        <div className="flex flex-wrap items-center gap-2">
          {[today, addDays(today, -1)].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                onDate(d);
                setShowDates(false);
              }}
              aria-pressed={date === d}
              className={`rounded-full px-3 py-1.5 text-sm active:scale-[0.97] ${
                date === d ? "bg-foreground text-background" : "bg-background ring-1 ring-border"
              }`}
            >
              {formatDay(d, today)}
            </button>
          ))}
          <label className="flex items-center gap-2 text-sm text-muted">
            Otra
            <input
              type="date"
              max={today}
              value={date}
              onChange={(e) => e.target.value && onDate(e.target.value)}
              className="h-9 rounded-xl border border-border bg-background px-2 text-foreground"
            />
          </label>
        </div>
      )}

      {showNote ? (
        <input
          autoFocus
          value={note}
          onChange={(e) => onNote(e.target.value)}
          maxLength={200}
          placeholder="Nota (opcional)"
          aria-label="Nota"
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

      <div>
        <p className="mb-2 px-1 text-sm text-muted">Toca la categoría para guardar</p>
        <div className="grid grid-cols-3 gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={pendingId !== null}
              onClick={() => onPick(c.id)}
              className={`flex h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-background px-1 ring-1 ring-border transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] ${
                pendingId && pendingId !== c.id ? "opacity-40" : ""
              } ${pendingId === c.id ? "ring-2 ring-foreground" : ""}`}
            >
              <span className="text-2xl" aria-hidden>
                {c.emoji}
              </span>
              <span className="w-full truncate text-center text-xs">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
