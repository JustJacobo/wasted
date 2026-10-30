"use client";

import { useState, useTransition } from "react";
import { CategoryIcon } from "@/components/category-icon";
import { categoryColorVar } from "@/lib/category-colors";
import { formatShortDay } from "@/lib/dates";
import { formatCOP, groupThousands } from "@/lib/money";
import { frequencyLabel, sameFrequency, type Frequency, type Recurring } from "@/lib/recurring";
import type { Category, TxType } from "@/lib/types";
import {
  createRecurring,
  deleteRecurring,
  setRecurringPaused,
  updateRecurring,
  type RecurringInput,
  type RecurringResult,
} from "./actions";
import { FrequencyPicker } from "./frequency-picker";

export function RecurringManager({
  recurring,
  categories,
  today,
}: {
  recurring: Recurring[];
  categories: Category[];
  today: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const active = recurring.filter((r) => !r.paused);
  const paused = recurring.filter((r) => r.paused);
  const byId = new Map(categories.map((c) => [c.id, c]));

  function run(action: () => Promise<RecurringResult>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else onOk?.();
    });
  }

  function edit(id: string) {
    setError(null);
    setCreating(false);
    setEditing(id);
  }

  const row = (r: Recurring) => {
    const category = r.category_id ? byId.get(r.category_id) : undefined;
    if (editing === r.id) {
      return (
        <li key={r.id} className="p-3">
          <RecurringForm
            initial={{ ...r, categoryId: r.category_id, nextOn: r.next_on, startsOn: r.starts_on }}
            categories={categories}
            today={today}
            pending={pending}
            submitLabel="Guardar"
            onCancel={() => setEditing(null)}
            onSubmit={(input) => run(() => updateRecurring({ ...input, id: r.id }), () => setEditing(null))}
          >
            <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setRecurringPaused(r.id, !r.paused), () => setEditing(null))}
                className="h-11 rounded-xl text-sm font-medium ring-1 ring-border transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
              >
                {r.paused ? "Reanudar" : "Pausar"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (confirm(`¿Eliminar "${r.description || category?.name || "este recurrente"}"? Lo ya agregado se queda.`)) {
                    run(() => deleteRecurring(r.id), () => setEditing(null));
                  }
                }}
                className="h-11 rounded-xl text-sm font-medium text-danger ring-1 ring-border transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
              >
                Eliminar
              </button>
            </div>
          </RecurringForm>
        </li>
      );
    }
    return (
      <li key={r.id}>
        <button
          type="button"
          onClick={() => edit(r.id)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-border/40"
        >
          <span className="flex shrink-0" style={{ color: categoryColorVar(category?.color) }}>
            <CategoryIcon category={category} className={`size-5 text-xl ${r.paused ? "opacity-50" : ""}`} />
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate ${r.paused ? "text-muted" : ""}`}>
              {r.description || category?.name || "Sin nombre"}
            </span>
            <span className="block truncate text-xs text-muted">
              {frequencyLabel(r.starts_on, r)}
              {!r.paused && ` · Próximo: ${r.next_on === today ? "hoy" : formatShortDay(r.next_on)}`}
            </span>
          </span>
          <span
            className={`shrink-0 font-mono text-[15px] tracking-tight ${
              r.type === "income" ? "text-accent-ink" : ""
            } ${r.paused ? "opacity-50" : ""}`}
          >
            {r.type === "income" ? "+" : "-"}
            {formatCOP(Number(r.amount))}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {active.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface ring-1 ring-border">
          {active.map(row)}
        </ul>
      ) : (
        !creating && (
          <p className="rounded-xl bg-surface px-5 py-8 text-center text-sm text-muted ring-1 ring-border">
            No tienes recurrentes. También puedes crear uno desde un movimiento: tócalo en el historial y
            elige Repetir.
          </p>
        )
      )}

      {creating ? (
        <div className="rounded-xl bg-surface p-3 ring-1 ring-border">
          <RecurringForm
            initial={{
              type: "expense",
              amount: 0,
              description: "",
              categoryId: null,
              every: 1,
              unit: "month",
              nextOn: today,
            }}
            categories={categories}
            today={today}
            pending={pending}
            submitLabel="Crear"
            onCancel={() => setCreating(false)}
            onSubmit={(input) => run(() => createRecurring(input), () => setCreating(false))}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setEditing(null);
            setCreating(true);
          }}
          className="h-12 w-full rounded-xl border border-dashed border-border font-medium text-muted transition-transform duration-150 ease-ui active:scale-[0.98]"
        >
          + Nuevo recurrente
        </button>
      )}

      {paused.length > 0 && (
        <details className="rounded-xl bg-surface ring-1 ring-border" open={paused.some((r) => r.id === editing)}>
          <summary className="cursor-pointer px-4 py-3 text-sm text-muted select-none">
            Pausados ({paused.length})
          </summary>
          <ul className="divide-y divide-border border-t border-border">{paused.map(row)}</ul>
        </details>
      )}
    </div>
  );
}

interface FormValues extends Frequency {
  type: TxType;
  amount: number;
  description: string;
  categoryId: string | null;
  nextOn: string;
  /** Inicio de la serie al editar: se conserva si no cambian la fecha ni la frecuencia. */
  startsOn?: string;
}

function RecurringForm({
  initial,
  categories,
  today,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
  children,
}: {
  initial: FormValues;
  categories: Category[];
  today: string;
  pending: boolean;
  submitLabel: string;
  onSubmit: (input: RecurringInput) => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  const [type, setType] = useState<TxType>(initial.type);
  const [amount, setAmount] = useState(initial.amount ? groupThousands(String(initial.amount)) : "");
  const [description, setDescription] = useState(initial.description);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [freq, setFreq] = useState<Frequency>({ every: initial.every, unit: initial.unit });
  const [nextOn, setNextOn] = useState(initial.nextOn);

  const options = categories.filter(
    (c) => c.type === type && (!c.archived || c.id === initial.categoryId),
  );
  const selected = options.some((c) => c.id === categoryId) ? categoryId : null;
  const digits = amount.replace(/\D/g, "");
  const ready = Number(digits) > 0 && description.trim() && selected && nextOn;
  // Igual que en el servidor: sin cambios de fecha ni frecuencia, la serie sigue desde su inicio.
  const anchor =
    initial.startsOn && nextOn === initial.nextOn && sameFrequency(freq, initial) ? initial.startsOn : nextOn;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        onSubmit({ type, amount: Number(digits), description, categoryId: selected, nextOn, ...freq });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-background p-1 ring-1 ring-border">
        {(["expense", "income"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            aria-pressed={type === t}
            className={`h-10 rounded-xl text-sm font-medium transition-colors duration-150 ${
              type === t ? "bg-foreground text-background" : "text-muted"
            }`}
          >
            {t === "expense" ? "Gasto" : "Ingreso"}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="mb-1 block px-1 text-sm text-muted">Monto</span>
        <div className="flex h-14 items-center rounded-xl border border-border bg-background px-4 focus-within:border-foreground">
          <span className="text-2xl text-muted">$</span>
          <input
            inputMode="numeric"
            enterKeyHint="next"
            autoFocus={!initial.amount}
            value={amount}
            onChange={(e) => setAmount(groupThousands(e.target.value.replace(/\D/g, "").slice(0, 12)))}
            className="tabular min-w-0 flex-1 bg-transparent px-2 text-2xl font-semibold outline-none"
          />
        </div>
      </label>

      <label className="block">
        <span className="mb-1 block px-1 text-sm text-muted">Nombre</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={type === "income" ? "Cuota semanal" : "Arriendo, Netflix…"}
          maxLength={200}
          enterKeyHint="done"
          className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none placeholder:text-muted focus:border-foreground"
        />
      </label>

      <fieldset>
        <legend className="mb-2 px-1 text-sm text-muted">Categoría</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              aria-pressed={selected === c.id}
              className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] ${
                selected === c.id ? "bg-foreground text-background" : "bg-background ring-1 ring-border"
              }`}
            >
              <CategoryIcon category={c} className="size-4 text-base" />
              {c.name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 px-1 text-sm text-muted">Se repite</legend>
        <FrequencyPicker value={freq} onChange={setFreq} />
      </fieldset>

      <label className="block">
        <span className="mb-1 block px-1 text-sm text-muted">Próxima fecha</span>
        <input
          type="date"
          required
          min={nextOn < today ? nextOn : today}
          value={nextOn}
          onChange={(e) => setNextOn(e.target.value)}
          className="h-12 w-full min-w-0 rounded-xl border border-border bg-background px-4 outline-none focus:border-foreground"
        />
        {nextOn && <span className="mt-1 block px-1 text-xs text-muted">{frequencyLabel(anchor, freq)}</span>}
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 flex-1 rounded-xl text-sm font-medium text-muted active:scale-[0.98]"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending || !ready}
          className="h-11 flex-1 rounded-xl bg-foreground text-sm font-semibold text-background transition-[transform,opacity] duration-150 ease-ui active:scale-[0.98] disabled:opacity-30"
        >
          {pending ? "Guardando…" : submitLabel}
        </button>
      </div>

      {children}
    </form>
  );
}
