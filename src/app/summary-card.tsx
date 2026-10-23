import { formatCOP, sizeForLength } from "@/lib/money";
import type { Summary } from "@/lib/types";
import { GoToPanel } from "./home-pager";

const monthName = new Intl.DateTimeFormat("es-CO", { month: "long", timeZone: "UTC" });

export function SummaryCard({ summary, today }: { summary: Summary; today: string }) {
  const { week, month } = summary;
  const left = week.income - week.expense;
  const hasIncome = week.income > 0;
  const month_ = monthName.format(new Date(`${today}T12:00:00Z`));
  const hero = formatCOP(hasIncome ? left : week.expense);

  return (
    <section className="mt-2 rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-border">
      <p className="text-sm text-muted">
        {hasIncome ? "Te quedan esta semana" : "Gastaste esta semana"}
      </p>
      <p
        className={`mt-1 font-bold tracking-tight ${sizeForLength(
          hero,
          [
            [11, "text-4xl"],
            [14, "text-3xl"],
          ],
          "text-2xl",
        )} ${hasIncome && left < 0 ? "text-danger" : ""}`}
      >
        {hero}
      </p>
      <p className="tabular mt-2 text-sm text-muted">
        Entró <span className="text-accent">{formatCOP(week.income)}</span> · Salió{" "}
        <span className="text-foreground">{formatCOP(week.expense)}</span>
      </p>

      <GoToPanel
        index={1}
        className="tabular mt-4 flex w-full items-center justify-between gap-2 border-t border-border pt-3 text-sm active:opacity-70"
      >
        <span className="text-muted capitalize">{month_}</span>
        <span className="flex items-center gap-2">
          <span>
            <span className="text-accent">+{formatCOP(month.income)}</span>
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
