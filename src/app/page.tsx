import { GearSix, Tray } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  active,
  getCategories,
  getMoneyOverview,
  getPendingCount,
  getRecentTransactions,
  getRules,
  getSummary,
  getUpcoming,
} from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { onAppOpen } from "@/lib/on-open";
import { payableForRule } from "@/lib/recurring-suggest";
import { ACCENT_COOKIE, MODE_COOKIE, parseAccent, parseMode } from "@/lib/theme";
import type { UpcomingCharge } from "@/lib/week-plan";
import { ScreenHeader } from "@/components/screen-header";
import { AppearanceSync } from "./appearance-sync";
import { AddLauncher } from "./add/add-launcher";
import { MoneyRows } from "./money-rows";
import { dashboardHref } from "./reportes/period-nav";
import { SummaryCard } from "./summary-card";
import { TransactionList } from "./transaction-list";
import { UpcomingCharges } from "./upcoming-charges";

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

/**
 * El recurrente que se paga al abrir (?recurrente=<regla>&ocurrencia=<fecha>, desde el Plan):
 * la fecha de "Próximos" si está; si no (más adelante en el mes), la que describen los parámetros.
 */
function chargeFromParams(params: Record<string, string | string[] | undefined>, upcoming: UpcomingCharge[]): UpcomingCharge | null {
  const ruleId = z.uuid().safeParse(params.recurrente).data;
  if (!ruleId) return null;
  const occurrence = z.iso.date().safeParse(params.ocurrencia).data;
  const exact = occurrence && upcoming.find((c) => c.ruleId === ruleId && c.occurrence === occurrence);
  if (exact) return exact;
  const amount = Number(one(params.monto));
  if (occurrence && Number.isInteger(amount) && amount > 0) {
    const tx = z.uuid().safeParse(params.tx).data ?? null;
    return {
      ruleId,
      occurrence,
      day: z.iso.date().safeParse(params.dia).data ?? occurrence,
      type: params.nuevo === "ingreso" ? "income" : "expense",
      amount,
      description: (one(params.nombre) ?? "").slice(0, 200),
      categoryId: z.uuid().safeParse(params.categoria).data ?? null,
      pending: tx !== null,
      txId: tx,
    };
  }
  return payableForRule(upcoming, ruleId);
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const today = todayIn();

  // El Dashboard ahora es la pestaña Reportes; los enlaces viejos (correos, accesos) siguen sirviendo.
  if (params.vista === "dashboard") {
    redirect(dashboardHref(params.periodo === "mes" ? "mes" : "semana", z.iso.date().safeParse(params.fecha).data ?? today));
  }

  const [{ name, userId, email, supabase }, summary, categories, rules, transactions, pendingCount, upcoming, money] =
    await Promise.all([
      requireUser(),
      getSummary(today),
      getCategories(),
      getRules(),
      getRecentTransactions(),
      getPendingCount(),
      getUpcoming(today),
      getMoneyOverview(),
    ]);

  // Después de responder, sin frenar la carga: recurrentes vencidos y correo.
  after(() => onAppOpen(userId, email, today));

  // Dispositivo nuevo: sin cookies de apariencia, se trae lo guardado en la cuenta.
  const jar = await cookies();
  const needsSync = !jar.has(ACCENT_COOKIE) || !jar.has(MODE_COOKIE);
  const saved = needsSync
    ? (await supabase.from("user_settings").select("accent, color_mode").maybeSingle()).data
    : null;

  return (
    <>
      {needsSync && (
        <AppearanceSync accent={parseAccent(saved?.accent)} mode={parseMode(saved?.color_mode)} />
      )}
      <main className="mx-auto max-w-lg px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-44">
        <ScreenHeader
          title={`Hola, ${name.split(" ")[0]}`}
          action={
            <Link href="/ajustes" aria-label="Ajustes" className="-mr-2 grid size-11 place-items-center rounded-xl text-muted active:scale-[0.97]">
              <GearSix aria-hidden className="size-6" />
            </Link>
          }
        />
        <SummaryCard summary={summary} upcoming={upcoming} today={today} />
        {pendingCount > 0 && (
          <Link
            href="/bandeja"
            className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 text-sm ring-1 ring-border active:scale-[0.99]"
          >
            <span>
              <Tray aria-hidden className="mr-2 inline size-4 align-[-2px] text-muted" />
              {pendingCount === 1 ? "1 movimiento por revisar" : `${pendingCount} movimientos por revisar`}
            </span>
            <span aria-hidden className="text-muted">
              ›
            </span>
          </Link>
        )}
        <MoneyRows {...money} />
        <UpcomingCharges upcoming={upcoming} categories={categories} today={today} />
        <TransactionList transactions={transactions} categories={categories} today={today} />
        {transactions.length > 0 && (
          <Link
            href="/movimientos"
            className="mt-4 block rounded-xl py-3 text-center text-sm font-medium text-muted active:scale-[0.98]"
          >
            Ver historial completo →
          </Link>
        )}
      </main>
      <AddLauncher
        categories={active(categories)}
        rules={rules}
        usage={transactions}
        upcoming={upcoming}
        initialType={params.nuevo === "ingreso" ? "income" : "expense"}
        initialCharge={chargeFromParams(params, upcoming)}
        requested={params.nuevo === "gasto" || params.nuevo === "ingreso"}
      />
    </>
  );
}
