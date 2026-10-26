import { cookies } from "next/headers";
import { available, balance, budgetStatus } from "@/lib/budget";
import { startOfWeek } from "@/lib/dates";
import { formatCOP, sizeForLength } from "@/lib/money";
import { REFILL_COOKIE } from "@/lib/theme";
import type { Summary, WeekBudget } from "@/lib/types";
import { BudgetMeter } from "./budget-meter";
import { GoToPanel } from "./home-pager";

const monthName = new Intl.DateTimeFormat("es-CO", { month: "long", timeZone: "UTC" });

export async function SummaryCard({ summary, today }: { summary: Summary; today: string }) {
  const { month, carry } = summary;
  const week: WeekBudget = { ...summary.week, carry };
  // El saldo no se reinicia cada lunes: lo que sobró o faltó pasa a esta semana.
  const hasBudget = budgetStatus(week).level !== "none";
  const left = balance(week);
  const month_ = monthName.format(new Date(`${today}T12:00:00Z`));
  const hero = formatCOP(hasBudget ? left : week.expense);
  const monday = startOfWeek(today);
  const refill = available(week) > 0 && (await cookies()).get(REFILL_COOKIE)?.value !== monday;

  return (
    <section className="mt-6">
      <p className="text-sm text-muted">{hasBudget ? "Te quedan" : "Gastaste esta semana"}</p>
      <p
        className={`tabular mt-1 font-semibold tracking-[-0.045em] ${sizeForLength(
          hero,
          [
            [11, "text-6xl"],
            [14, "text-5xl"],
          ],
          "text-4xl",
        )} ${hasBudget && left < 0 ? "text-danger" : ""}`}
      >
        {hero}
      </p>
      <p className="tabular mt-2 text-sm text-muted">
        Esta semana entró <span className="text-foreground">{formatCOP(week.income)}</span> · salió{" "}
        <span className="text-foreground">{formatCOP(week.expense)}</span>
      </p>
      {carry !== 0 && (
        <p className="tabular mt-0.5 text-sm text-muted">
          Saldo anterior <span className="text-foreground">{formatCOP(carry)}</span>
        </p>
      )}
      <BudgetMeter week={week} refillWeek={refill ? monday : undefined} />

      <GoToPanel
        index={1}
        className="tabular mt-6 flex w-full items-center justify-between gap-2 border-y border-border py-3 text-sm active:opacity-70"
      >
        <span className="text-muted capitalize">{month_}</span>
        <span className="flex items-center gap-2">
          <span>
            <span>+{formatCOP(month.income)}</span>
            <span className="text-muted"> · </span>
            <span>-{formatCOP(month.expense)}</span>
          </span>
          <span aria-hidden className="text-muted">
            ›
          </span>
          <span className="sr-only">Ver dashboard</span>
        </span>
      </GoToPanel>
    </section>
  );
}
