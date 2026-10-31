import { Tray } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { cookies } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  active,
  getCategories,
  getMoneyOverview,
  getPendingCount,
  getRecentTransactions,
  getReport,
  getRules,
  getSummary,
  getUpcoming,
} from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { shouldAutoSync, syncMail } from "@/lib/mail-import/sync";
import { generateDue } from "@/lib/recurring-run";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyRecurringDue } from "@/lib/telegram/notify";
import type { PeriodKind } from "@/lib/report";
import { ACCENT_COOKIE, MODE_COOKIE, parseAccent, parseMode } from "@/lib/theme";
import { Logo } from "@/components/logo";
import { AppearanceSync } from "./appearance-sync";
import { AddLauncher } from "./add/add-launcher";
import { HomePager } from "./home-pager";
import { MoneyRows } from "./money-rows";
import { ReportView } from "./reportes/report-view";
import { SummaryCard } from "./summary-card";
import { TransactionList } from "./transaction-list";
import { UpcomingCharges } from "./upcoming-charges";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const today = todayIn();

  // Dashboard: ?vista=dashboard&periodo=semana|mes&fecha=YYYY-MM-DD
  const kind: PeriodKind = params.periodo === "mes" ? "mes" : "semana";
  const requested = z.iso.date().safeParse(params.fecha);
  const anchor = requested.success && requested.data <= today ? requested.data : today;
  const onDashboard = params.vista === "dashboard";

  const [{ name, userId, email, supabase }, summary, categories, rules, transactions, report, pendingCount, upcoming, money] =
    await Promise.all([
      requireUser(),
      getSummary(today),
      getCategories(),
      getRules(),
      getRecentTransactions(),
      getReport(kind, anchor, today),
      getPendingCount(),
      getUpcoming(today),
      getMoneyOverview(),
    ]);

  // Después de responder, sin frenar la carga: recurrentes vencidos (respaldo
  // del cron diario) y el correo (máximo cada 10 min).
  after(async () => {
    try {
      const admin = createAdminClient();
      await notifyRecurringDue(admin, userId, await generateDue(admin, userId, today), today);
    } catch (error) {
      console.error("recurrentes: fallo la generación al abrir", error);
    }
    try {
      if (await shouldAutoSync(userId, email)) await syncMail(userId, email);
    } catch (error) {
      console.error("correo: fallo la revisión automática", error);
    }
  });

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
      <HomePager
        initialPanel={onDashboard ? 1 : 0}
        home={
          <>
            <div className="mb-2 flex items-center gap-2 px-1">
              <Logo className="h-4 w-auto" title={null} />
              <p className="text-sm text-muted capitalize">Hola, {name.split(" ")[0]}</p>
            </div>
            <SummaryCard summary={summary} upcoming={upcoming} today={today} />
            {pendingCount > 0 && (
              <Link
                href="/bandeja"
                className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 text-sm ring-1 ring-border active:scale-[0.99]"
              >
                <span>
                  <Tray aria-hidden className="mr-2 inline size-4 align-[-2px] text-muted" />
                  {pendingCount === 1
                    ? "1 movimiento por revisar"
                    : `${pendingCount} movimientos por revisar`}
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
          </>
        }
        dashboard={<ReportView kind={kind} report={report} today={today} />}
      />
      <AddLauncher
        categories={active(categories)}
        rules={rules}
        usage={transactions}
        initialType={params.nuevo === "ingreso" ? "income" : "expense"}
        startOpen={!onDashboard}
      />
    </>
  );
}
