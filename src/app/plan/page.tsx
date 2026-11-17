import { CheckCircle, Handshake, PiggyBank, Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { ListRow, ListSection } from "@/components/list";
import { ScreenHeader } from "@/components/screen-header";
import { TabBar } from "@/components/tab-bar";
import { categoryColorVar } from "@/lib/category-colors";
import { getCategories, getPlan } from "@/lib/data";
import { formatMonth, todayIn } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { scheduleLabel, type ScheduledCharge } from "@/lib/recurring-schedule";

/** A dónde lleva tocar una fecha: pagarla (la ventana de registro lista), ver el pago o el recurrente. */
function hrefFor(c: ScheduledCharge): string {
  if (c.payable) {
    const params = new URLSearchParams({
      nuevo: c.type === "income" ? "ingreso" : "gasto",
      recurrente: c.ruleId,
      ocurrencia: c.occurrence,
      dia: c.day,
      monto: String(c.amount),
      nombre: c.description,
      ...(c.categoryId ? { categoria: c.categoryId } : {}),
      ...(c.txId ? { tx: c.txId } : {}),
    });
    return `/?${params}`;
  }
  return c.status === "paid" && c.txId ? `/movimientos/${c.txId}` : "/recurrentes";
}

function Progress({ value, label }: { value: number; label: string }) {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className="h-1.5 overflow-hidden rounded-full bg-border"
    >
      <div className="h-full rounded-full bg-[var(--viz)]" style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}

/**
 * Plan: lo que se repite y lo que está aparte del día a día. Los pagos fijos
 * del mes (qué falta y qué ya se pagó), los préstamos abiertos y las metas.
 */
export default async function PlanPage() {
  const today = todayIn();
  const [plan, categories] = await Promise.all([getPlan(today), getCategories()]);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const { items, expense, income } = plan.schedule;
  const { owedToMe, iOwe, open } = plan.loans;
  const loansSummary = [owedToMe > 0 && `Te deben ${formatCOP(owedToMe)}`, iOwe > 0 && `Debes ${formatCOP(iOwe)}`].filter(Boolean).join(" · ");

  return (
    <>
      <main className="mx-auto max-w-lg space-y-7 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-32">
        <ScreenHeader title="Plan" />

        <section className="space-y-3">
          <div className="flex min-h-6 items-center justify-between gap-3 px-1">
            <h2 className="text-sm font-medium text-muted">Pagos fijos · {formatMonth(plan.from)}</h2>
            {(plan.active > 0 || plan.paused > 0) && (
              <Link href="/recurrentes" className="text-sm font-medium text-muted active:opacity-70">
                Administrar
              </Link>
            )}
          </div>

          {items.length === 0 ? (
            <div className="space-y-3 rounded-xl bg-surface px-5 py-6 text-center ring-1 ring-border">
              <p className="text-sm text-muted">
                Agrega el arriendo, tus suscripciones o la cuota semanal: aquí verás qué falta por pagar este mes y lo
                marcas pagado con un toque.
              </p>
              <Link
                href="/recurrentes?nuevo=1"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background active:scale-[0.97]"
              >
                <Plus aria-hidden weight="bold" className="size-4" />
                Nuevo recurrente
              </Link>
            </div>
          ) : (
            <>
              {expense.total > 0 && (
                <div className="space-y-2.5 rounded-xl bg-surface p-4 ring-1 ring-border">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-muted">{expense.left > 0 ? "Falta pagar" : "Todo pagado"}</span>
                    <span className="tabular truncate text-2xl font-bold tracking-tight">
                      {formatCOP(expense.left > 0 ? expense.left : expense.paid)}
                    </span>
                  </div>
                  <Progress value={expense.paid / expense.total} label={`Pagado ${formatCOP(expense.paid)} de ${formatCOP(expense.total)}`} />
                  <p className="tabular text-[13px] text-muted">
                    Pagado {formatCOP(expense.paid)} de {formatCOP(expense.total)}
                    {income.total > 0 && ` · Ingresos fijos ${formatCOP(income.paid)} de ${formatCOP(income.total)}`}
                  </p>
                </div>
              )}

              <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface ring-1 ring-border">
                {items.map((c) => {
                  const category = c.categoryId ? byId.get(c.categoryId) : undefined;
                  const done = c.status === "paid" || c.status === "skipped";
                  const urgent = c.status === "pending" || c.status === "overdue";
                  const name = c.description || category?.name || "Recurrente";
                  return (
                    <li key={`${c.ruleId}:${c.occurrence}:${c.txId ?? ""}`}>
                      <Link
                        href={hrefFor(c)}
                        aria-label={`${name}, ${scheduleLabel(c, today)}, ${formatCOP(c.amount)}${c.payable ? ", marcar pagado" : ""}`}
                        className="flex min-h-15 items-center gap-3 px-4 py-2.5 transition-colors active:bg-border/40"
                      >
                        {c.status === "paid" ? (
                          <CheckCircle aria-hidden weight="fill" className="size-6 shrink-0 text-muted" />
                        ) : (
                          <span className="flex shrink-0" style={{ color: categoryColorVar(category?.color) }}>
                            <CategoryIcon category={category} className="size-6 text-2xl" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate ${done ? "text-muted" : ""}`}>{name}</span>
                          <span className={`block truncate text-[13px] ${urgent ? "font-medium" : "text-muted"}`}>
                            {scheduleLabel(c, today)}
                            {c.more > 0 && ` · y ${c.more} más este mes`}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 font-mono text-[15px] tracking-tight ${done ? "text-muted" : c.type === "income" ? "text-accent-ink" : ""} ${c.status === "skipped" ? "line-through" : ""}`}
                        >
                          {c.type === "income" ? "+" : "-"}
                          {formatCOP(c.amount)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
                <li>
                  <ListRow href="/recurrentes?nuevo=1" icon={<Plus aria-hidden className="size-5" />} title="Nuevo recurrente" trailing={<span />} />
                </li>
              </ul>
            </>
          )}
        </section>

        <ListSection
          title="Préstamos"
          note={open.length === 0 ? "Anota lo que prestas o te prestan: no cuenta como gasto, pero sí en lo que te queda." : undefined}
        >
          {open.length === 0 ? (
            <ListRow href="/prestamos" icon={<Handshake aria-hidden className="size-5" />} title="Anotar un préstamo" />
          ) : (
            <>
              <ListRow href="/prestamos" icon={<Handshake aria-hidden className="size-5" />} title={loansSummary} />
              {open.slice(0, 3).map((l) => (
                <ListRow
                  key={l.id}
                  href="/prestamos"
                  title={l.person}
                  subtitle={l.direction === "lent" ? "Te debe" : "Le debes"}
                  value={formatCOP(l.outstanding)}
                />
              ))}
            </>
          )}
        </ListSection>

        {plan.goals.items.length === 0 ? (
          <ListSection title="Metas" note="Aparta plata para algo (un viaje, un colchón): sale de lo que te queda sin contar como gasto.">
            <ListRow href="/metas" icon={<PiggyBank aria-hidden className="size-5" />} title="Crear una meta" />
          </ListSection>
        ) : (
          <ListSection title={`Metas · ${formatCOP(plan.goals.total)} apartados`}>
            {plan.goals.items.map((g) => (
              <Link key={g.id} href="/metas" className="block space-y-2 px-4 py-3.5 transition-colors active:bg-border/40">
                <span className="flex items-baseline gap-3">
                  <span className="line-clamp-2 min-w-0 flex-1">{g.name}</span>
                  <span className="tabular shrink-0 text-sm text-muted">
                    {formatCOP(g.saved)}
                    {g.target ? ` de ${formatCOP(g.target)}` : ""}
                  </span>
                </span>
                {g.progress !== null && <Progress value={g.progress} label={`${g.name}: ${Math.round(g.progress * 100)} %`} />}
              </Link>
            ))}
          </ListSection>
        )}

        {plan.paused > 0 && (
          <p className="px-1 text-xs text-muted">
            {plan.paused === 1 ? "1 recurrente en pausa." : `${plan.paused} recurrentes en pausa.`} Se reanudan en Administrar.
          </p>
        )}
      </main>
      <TabBar />
    </>
  );
}
