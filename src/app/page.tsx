import { EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { cookies } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  active,
  getCategories,
  getPendingCount,
  getRecentTransactions,
  getReport,
  getRules,
  getSummary,
} from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { shouldAutoSync, syncMail } from "@/lib/mail-import/sync";
import type { PeriodKind } from "@/lib/report";
import { ACCENT_COOKIE, parseAccent } from "@/lib/theme";
import { Logo } from "@/components/logo";
import { AccentSync } from "./accent-sync";
import { AddLauncher } from "./add/add-launcher";
import { HomePager } from "./home-pager";
import { ReportView } from "./reportes/report-view";
import { SummaryCard } from "./summary-card";
import { TransactionList } from "./transaction-list";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const today = todayIn();

  // Dashboard: ?vista=dashboard&periodo=semana|mes&fecha=YYYY-MM-DD
  const kind: PeriodKind = params.periodo === "mes" ? "mes" : "semana";
  const requested = z.iso.date().safeParse(params.fecha);
  const anchor = requested.success && requested.data <= today ? requested.data : today;
  const onDashboard = params.vista === "dashboard";

  const [{ name, userId, email, supabase }, summary, categories, rules, transactions, report, pendingCount] =
    await Promise.all([
      requireUser(),
      getSummary(today),
      getCategories(),
      getRules(),
      getRecentTransactions(),
      getReport(kind, anchor, today),
      getPendingCount(),
    ]);

  // Revisa el correo después de responder, sin frenar la carga (máximo cada 10 min).
  after(async () => {
    try {
      if (await shouldAutoSync(userId, email)) await syncMail(userId, email);
    } catch (error) {
      console.error("correo: fallo la revisión automática", error);
    }
  });

  // Dispositivo nuevo: sin cookie del tema, se trae el de la cuenta.
  const hasAccentCookie = (await cookies()).has(ACCENT_COOKIE);
  const savedAccent = hasAccentCookie
    ? null
    : parseAccent((await supabase.from("user_settings").select("accent").maybeSingle()).data?.accent);

  return (
    <>
      {savedAccent && <AccentSync accent={savedAccent} />}
      <HomePager
        initialPanel={onDashboard ? 1 : 0}
        home={
          <>
            <div className="mb-2 flex items-center gap-2 px-1">
              <Logo className="h-4 w-auto" title={null} />
              <p className="text-sm text-muted capitalize">Hola, {name.split(" ")[0]}</p>
            </div>
            <SummaryCard summary={summary} today={today} />
            {pendingCount > 0 && (
              <Link
                href="/bandeja"
                className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 text-sm ring-1 ring-border active:scale-[0.99]"
              >
                <span>
                  <EnvelopeSimple aria-hidden className="mr-2 inline size-4 align-[-2px] text-muted" />
                  {pendingCount === 1
                    ? "1 movimiento por revisar"
                    : `${pendingCount} movimientos por revisar`}
                </span>
                <span aria-hidden className="text-muted">
                  ›
                </span>
              </Link>
            )}
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
