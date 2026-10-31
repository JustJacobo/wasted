import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { getCategories, getTransactionsForMonth } from "@/lib/data";
import { addDays, formatMonth, todayIn } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { TransactionList } from "../transaction-list";
import { HistoryFilters } from "./history-filters";
import { historyParams } from "./params";

export default async function HistoryPage({ searchParams }: PageProps<"/movimientos">) {
  const today = todayIn();
  const { current, month, typeKey, categoryId, query, filters } = historyParams(await searchParams, today);

  const [transactions, categories] = await Promise.all([getTransactionsForMonth(filters), getCategories()]);

  const search = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const merged = { mes: month, tipo: typeKey, cat: categoryId, q: query || null, ...changes };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === "tipo" && v === "todos") && !(k === "mes" && v === current)) next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `?${qs}` : "";
  };
  const href = (changes: Record<string, string | null>) => `/movimientos${search(changes)}`;
  const prevMonth = addDays(`${month}-01`, -1).slice(0, 7);
  const nextMonth = addDays(`${month}-28`, 7).slice(0, 7);
  const filtered = typeKey !== "todos" || categoryId !== null || query !== "";

  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);

  const arrow =
    "grid size-11 place-items-center rounded-xl text-xl transition-transform duration-150 ease-ui active:scale-[0.97]";

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-2 py-2">
        <Link href="/" className="rounded-lg px-2 py-1 text-sm text-muted active:scale-[0.97]">
          ← Volver
        </Link>
        <h1 className="flex-1 text-right text-lg font-bold tracking-tight">Historial</h1>
      </header>

      <div className="flex items-center justify-between">
        <Link href={href({ mes: prevMonth })} replace scroll={false} aria-label="Mes anterior" className={arrow}>
          ‹
        </Link>
        <h2 className="font-semibold">{formatMonth(`${month}-01`)}</h2>
        {month >= current ? (
          <span aria-hidden className={`${arrow} opacity-20`}>
            ›
          </span>
        ) : (
          <Link href={href({ mes: nextMonth })} replace scroll={false} aria-label="Mes siguiente" className={arrow}>
            ›
          </Link>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface p-1 ring-1 ring-border">
        {(["todos", "gasto", "ingreso"] as const).map((t) => (
          <Link
            key={t}
            href={href({ tipo: t })}
            replace
            scroll={false}
            aria-current={t === typeKey ? "page" : undefined}
            className={`grid h-10 place-items-center rounded-xl text-sm font-medium transition-colors duration-150 ${
              t === typeKey ? "bg-foreground text-background" : "text-muted"
            }`}
          >
            {t === "todos" ? "Todo" : t === "gasto" ? "Gastos" : "Ingresos"}
          </Link>
        ))}
      </div>

      <HistoryFilters categories={categories} categoryId={categoryId} query={query} />

      <div className="flex items-center justify-between gap-3 px-1">
        <p className="tabular min-w-0 text-sm text-muted" aria-live="polite">
          {transactions.length} {transactions.length === 1 ? "movimiento" : "movimientos"}
          {expense > 0 && (
            <>
              {" · Gastos "}
              <span className="text-foreground">{formatCOP(expense)}</span>
            </>
          )}
          {income > 0 && (
            <>
              {" · Ingresos "}
              <span className="text-foreground">{formatCOP(income)}</span>
            </>
          )}
        </p>
        {transactions.length > 0 && (
          // Sin `download`: si la sesión venció, el enlace lleva a /login en vez de bajar esa página.
          <a
            href={`/movimientos/exportar${search({})}`}
            aria-label={`Descargar ${filtered ? "lo filtrado de " : ""}${formatMonth(`${month}-01`)} en CSV`}
            className="-my-3 -mr-2 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-2 text-sm text-muted transition-transform duration-150 ease-ui active:scale-[0.97]"
          >
            <DownloadSimple aria-hidden className="size-4" />
            CSV
          </a>
        )}
      </div>

      <TransactionList
        transactions={transactions}
        categories={categories}
        today={today}
        returnTo={href({})}
        empty={
          filtered ? (
            <>
              Nada con estos filtros.{" "}
              <Link href={href({ tipo: "todos", cat: null, q: null })} className="underline">
                Quitar filtros
              </Link>
            </>
          ) : (
            "No hay movimientos en este mes."
          )
        }
      />
    </main>
  );
}
