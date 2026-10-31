"use client";

import { useState, useTransition } from "react";
import { formatDay } from "@/lib/dates";
import { formatCOP, groupThousands } from "@/lib/money";
import type { BalanceMove, LoanSummary } from "@/lib/money-moves";
import { addLoan, deleteLoan, payLoan, removeLoanMove, type LoanActionResult } from "./actions";

const button =
  "h-11 rounded-xl text-sm font-medium ring-1 ring-border transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50";
const primary =
  "h-11 rounded-xl bg-foreground text-sm font-medium text-background transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50";
const field =
  "h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none placeholder:text-muted focus:border-foreground";

/** Monto con separador de miles mientras se escribe; devuelve el texto y el número. */
function useAmount(initial = 0) {
  const [text, setText] = useState(initial ? groupThousands(String(initial)) : "");
  return {
    text,
    value: Number(text.replace(/\D/g, "")),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setText(groupThousands(e.target.value.replace(/\D/g, "").slice(0, 12))),
  };
}

function moveLabel(direction: "lent" | "borrowed", amount: number): string {
  if (direction === "lent") return amount < 0 ? "Le prestaste" : "Te pagó";
  return amount > 0 ? "Te prestó" : "Le pagaste";
}

export function LoansManager({ items, today }: { items: LoanSummary[]; today: string }) {
  const [creating, setCreating] = useState<"lend" | "borrow" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const people = [...new Set(items.map((i) => i.loan.person))];
  const active = items.filter((i) => i.outstanding > 0);
  const settled = items.filter((i) => i.outstanding <= 0);

  function run(action: () => Promise<LoanActionResult>, onOk?: () => void) {
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

  const row = (item: LoanSummary) => {
    const { loan } = item;
    const isOpen = open === loan.id;
    const lent = loan.direction === "lent";
    return (
      <li key={loan.id}>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setOpen(isOpen ? null : loan.id)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-border/40"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate">{loan.person}</span>
            <span className="block truncate text-xs text-muted">
              {item.outstanding > 0 ? (lent ? "Te debe" : "Le debes") : "Saldado"}
              {item.moves[0] && ` · ${formatDay(item.moves[0].occurred_on, today)}`}
            </span>
          </span>
          <span className={`tabular shrink-0 font-mono text-[15px] tracking-tight ${item.outstanding > 0 ? "" : "text-muted"}`}>
            {formatCOP(Math.max(0, item.outstanding))}
          </span>
        </button>
        {isOpen && (
          <LoanDetail
            // Tras un pago, el monto sugerido vuelve a ser lo pendiente.
            key={item.outstanding}
            item={item}
            today={today}
            pending={pending}
            onPay={(amount) => run(() => payLoan({ loanId: loan.id, amount }))}
            onRemoveMove={(move) => {
              if (confirm(`¿Quitar "${moveLabel(loan.direction, move.amount)} ${formatCOP(Math.abs(move.amount))}"?`)) {
                run(() => removeLoanMove(move.id));
              }
            }}
            onDelete={() => {
              if (confirm(`¿Borrar el préstamo con ${loan.person}? Deja de contar en tu saldo.`)) {
                run(() => deleteLoan(loan.id), () => setOpen(null));
              }
            }}
          />
        )}
      </li>
    );
  };

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

      {creating ? (
        <NewLoanForm
          kind={creating}
          people={people}
          pending={pending}
          onCancel={() => setCreating(null)}
          onSubmit={(person, amount) => run(() => addLoan({ kind: creating, person, amount }), () => setCreating(null))}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setCreating("lend")} className={button}>
            Presté
          </button>
          <button type="button" onClick={() => setCreating("borrow")} className={button}>
            Me prestaron
          </button>
        </div>
      )}

      {active.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface ring-1 ring-border">{active.map(row)}</ul>
      ) : (
        <p className="rounded-xl bg-surface px-5 py-8 text-center text-sm text-muted ring-1 ring-border">
          Nadie te debe y no le debes a nadie.
        </p>
      )}

      {settled.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm text-muted">Saldados</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface ring-1 ring-border">
            {settled.slice(0, 20).map(row)}
          </ul>
        </section>
      )}
    </div>
  );
}

function NewLoanForm({
  kind,
  people,
  pending,
  onSubmit,
  onCancel,
}: {
  kind: "lend" | "borrow";
  people: string[];
  pending: boolean;
  onSubmit: (person: string, amount: number) => void;
  onCancel: () => void;
}) {
  const [person, setPerson] = useState("");
  const amount = useAmount();
  const ready = person.trim() && amount.value > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit(person.trim(), amount.value);
      }}
      className="space-y-3 rounded-xl bg-surface p-3 ring-1 ring-border"
    >
      <p className="px-1 text-sm font-medium">{kind === "lend" ? "¿A quién le prestaste?" : "¿Quién te prestó?"}</p>
      <label className="sr-only" htmlFor="loan-person">
        Nombre
      </label>
      <input
        id="loan-person"
        list="loan-people"
        autoFocus
        value={person}
        onChange={(e) => setPerson(e.target.value)}
        placeholder="Nombre"
        autoComplete="off"
        maxLength={60}
        className={field}
      />
      <datalist id="loan-people">
        {people.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <label className="sr-only" htmlFor="loan-amount">
        Monto
      </label>
      <input
        id="loan-amount"
        inputMode="numeric"
        value={amount.text}
        onChange={amount.onChange}
        placeholder="$ 0"
        className={`${field} tabular`}
      />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className={button}>
          Cancelar
        </button>
        <button type="submit" disabled={!ready || pending} className={primary}>
          Guardar
        </button>
      </div>
    </form>
  );
}

function LoanDetail({
  item,
  today,
  pending,
  onPay,
  onRemoveMove,
  onDelete,
}: {
  item: LoanSummary;
  today: string;
  pending: boolean;
  onPay: (amount: number) => void;
  onRemoveMove: (move: BalanceMove) => void;
  onDelete: () => void;
}) {
  const { loan } = item;
  const amount = useAmount(Math.max(0, item.outstanding));

  return (
    <div className="space-y-3 border-t border-border bg-background/50 px-4 py-3">
      {item.outstanding > 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (amount.value > 0) onPay(amount.value);
          }}
          className="flex gap-2"
        >
          <label className="sr-only" htmlFor={`pay-${loan.id}`}>
            Monto del pago
          </label>
          <input
            id={`pay-${loan.id}`}
            inputMode="numeric"
            value={amount.text}
            onChange={amount.onChange}
            className={`${field} tabular min-w-0 flex-1`}
          />
          <button type="submit" disabled={!amount.value || pending} className={`${primary} shrink-0 px-4`}>
            {loan.direction === "lent" ? "Me pagó" : "Le pagué"}
          </button>
        </form>
      )}

      <ul className="space-y-1">
        {item.moves.map((move) => (
          <li key={move.id} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-muted">
              {formatDay(move.occurred_on, today)} · {moveLabel(loan.direction, move.amount)}
            </span>
            <span className="tabular shrink-0">{formatCOP(Math.abs(move.amount))}</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => onRemoveMove(move)}
              aria-label="Quitar este movimiento"
              className="-my-2 grid size-11 shrink-0 place-items-center rounded-xl text-muted active:scale-[0.97] disabled:opacity-50"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <button type="button" disabled={pending} onClick={onDelete} className={`${button} w-full text-danger`}>
        Borrar préstamo
      </button>
    </div>
  );
}
