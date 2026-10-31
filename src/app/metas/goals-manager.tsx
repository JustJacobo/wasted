"use client";

import { useState, useTransition } from "react";
import { formatCOP, groupThousands } from "@/lib/money";
import type { GoalSummary } from "@/lib/money-moves";
import {
  archiveGoal,
  createGoal,
  deleteGoal,
  moveGoal,
  setGoalTarget,
  type GoalActionResult,
} from "./actions";

const button =
  "h-11 rounded-xl text-sm font-medium ring-1 ring-border transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50";
const primary =
  "h-11 rounded-xl bg-foreground text-sm font-medium text-background transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50";
const field =
  "h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none placeholder:text-muted focus:border-foreground";
const percent = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 0 });

function useAmount(initial: number | null = null) {
  const [text, setText] = useState(initial ? groupThousands(String(initial)) : "");
  return {
    text,
    value: Number(text.replace(/\D/g, "")),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setText(groupThousands(e.target.value.replace(/\D/g, "").slice(0, 12))),
  };
}

export function GoalsManager({ items }: { items: GoalSummary[] }) {
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const active = items.filter((g) => !g.goal.archived);
  const archived = items.filter((g) => g.goal.archived);

  function run(action: () => Promise<GoalActionResult>, onOk?: () => void) {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setNotice({ text: result.error, error: true });
      else {
        if (result.message) setNotice({ text: `${result.message}.`, error: false });
        onOk?.();
      }
    });
  }

  return (
    <div className="space-y-4">
      {notice && (
        <p
          role={notice.error ? "alert" : "status"}
          className={`rounded-xl px-4 py-3 text-sm ${notice.error ? "bg-danger/10 text-danger" : "bg-surface ring-1 ring-border"}`}
        >
          {notice.text}
        </p>
      )}

      {active.length === 0 && !creating && (
        <p className="rounded-xl bg-surface px-5 py-8 text-center text-sm text-muted ring-1 ring-border">
          Aún no tienes metas. Crea una para apartar plata para algo: un viaje, un portátil, un colchón.
        </p>
      )}

      {active.length > 0 && (
        <ul className="space-y-2">
          {active.map((item) => (
            <GoalCard key={item.goal.id} item={item} pending={pending} run={run} />
          ))}
        </ul>
      )}

      {creating ? (
        <NewGoalForm
          pending={pending}
          onCancel={() => setCreating(false)}
          onSubmit={(name, target) => run(() => createGoal({ name, target }), () => setCreating(false))}
        />
      ) : (
        <button type="button" onClick={() => setCreating(true)} className={`${button} w-full`}>
          Nueva meta
        </button>
      )}

      {archived.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm text-muted">Archivadas</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface ring-1 ring-border">
            {archived.map(({ goal }) => (
              <li key={goal.id} className="flex items-center gap-2 px-4 py-2">
                <span className="min-w-0 flex-1 truncate text-muted">{goal.name}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => archiveGoal(goal.id, false))}
                  className="h-11 shrink-0 rounded-xl px-3 text-sm active:scale-[0.97] disabled:opacity-50"
                >
                  Reactivar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function GoalCard({
  item,
  pending,
  run,
}: {
  item: GoalSummary;
  pending: boolean;
  run: (action: () => Promise<GoalActionResult>, onOk?: () => void) => void;
}) {
  const { goal, saved, progress } = item;
  const [mode, setMode] = useState<"save" | "withdraw" | "target" | null>(null);
  const amount = useAmount();
  const target = useAmount(goal.target);
  const done = progress !== null && progress >= 1;

  return (
    <li className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-border">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-medium">{goal.name}</span>
        <span className="tabular shrink-0 text-sm text-muted">
          {goal.target ? `${percent.format(progress ?? 0)} de ${formatCOP(goal.target)}` : "Sin meta"}
        </span>
      </div>
      <p className="tabular text-2xl font-semibold tracking-tight">{formatCOP(Math.max(0, saved))}</p>
      {progress !== null && (
        <div
          role="meter"
          aria-label={`Avance de ${goal.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="h-1.5 overflow-hidden rounded-full bg-border"
        >
          <div
            className="h-full origin-left rounded-full bg-viz transition-transform duration-500 ease-ui motion-reduce:transition-none"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      )}
      {done && <p className="text-sm">Lo lograste: ya tienes lo que te propusiste.</p>}

      {mode === "save" || mode === "withdraw" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (amount.value > 0) run(() => moveGoal({ goalId: goal.id, kind: mode, amount: amount.value }), () => setMode(null));
          }}
          className="flex gap-2"
        >
          <label className="sr-only" htmlFor={`goal-${goal.id}`}>
            {mode === "save" ? "Cuánto apartas" : "Cuánto sacas"}
          </label>
          <input
            id={`goal-${goal.id}`}
            inputMode="numeric"
            autoFocus
            value={amount.text}
            onChange={amount.onChange}
            placeholder="$ 0"
            className={`${field} tabular min-w-0 flex-1`}
          />
          <button type="submit" disabled={!amount.value || pending} className={`${primary} shrink-0 px-4`}>
            {mode === "save" ? "Apartar" : "Sacar"}
          </button>
          <button type="button" onClick={() => setMode(null)} aria-label="Cancelar" className={`${button} shrink-0 px-3`}>
            ×
          </button>
        </form>
      ) : mode === "target" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => setGoalTarget({ goalId: goal.id, target: target.value || null }), () => setMode(null));
          }}
          className="flex gap-2"
        >
          <label className="sr-only" htmlFor={`target-${goal.id}`}>
            Meta
          </label>
          <input
            id={`target-${goal.id}`}
            inputMode="numeric"
            autoFocus
            value={target.text}
            onChange={target.onChange}
            placeholder="Sin meta"
            className={`${field} tabular min-w-0 flex-1`}
          />
          <button type="submit" disabled={pending} className={`${primary} shrink-0 px-4`}>
            Guardar
          </button>
          <button type="button" onClick={() => setMode(null)} aria-label="Cancelar" className={`${button} shrink-0 px-3`}>
            ×
          </button>
        </form>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode("save")} className={primary}>
              Apartar
            </button>
            <button type="button" disabled={saved <= 0} onClick={() => setMode("withdraw")} className={button}>
              Sacar
            </button>
          </div>
          <div className="flex justify-between text-sm">
            <button
              type="button"
              onClick={() => setMode("target")}
              className="-mx-2 h-11 rounded-xl px-2 text-muted active:scale-[0.97]"
            >
              {goal.target ? "Cambiar meta" : "Ponerle meta"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (saved > 0) {
                  if (confirm(`¿Borrar ${goal.name}? Los ${formatCOP(saved)} apartados vuelven a tu saldo.`)) {
                    run(() => deleteGoal(goal.id));
                  }
                } else {
                  run(() => archiveGoal(goal.id, true));
                }
              }}
              className="-mx-2 h-11 rounded-xl px-2 text-muted active:scale-[0.97] disabled:opacity-50"
            >
              {saved > 0 ? "Borrar" : "Archivar"}
            </button>
          </div>
        </>
      )}
    </li>
  );
}

function NewGoalForm({
  pending,
  onSubmit,
  onCancel,
}: {
  pending: boolean;
  onSubmit: (name: string, target: number | null) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const target = useAmount();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSubmit(name.trim(), target.value || null);
      }}
      className="space-y-3 rounded-xl bg-surface p-3 ring-1 ring-border"
    >
      <label className="sr-only" htmlFor="goal-name">
        Nombre
      </label>
      <input
        id="goal-name"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Viaje, portátil, colchón…"
        maxLength={60}
        autoComplete="off"
        className={field}
      />
      <label className="sr-only" htmlFor="goal-target">
        Cuánto quieres juntar (opcional)
      </label>
      <input
        id="goal-target"
        inputMode="numeric"
        value={target.text}
        onChange={target.onChange}
        placeholder="Cuánto quieres juntar (opcional)"
        className={`${field} tabular`}
      />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className={button}>
          Cancelar
        </button>
        <button type="submit" disabled={!name.trim() || pending} className={primary}>
          Crear
        </button>
      </div>
    </form>
  );
}
