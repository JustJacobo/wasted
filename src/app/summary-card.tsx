import { formatCOP } from "@/lib/money";
import type { Summary } from "@/lib/types";

const monthName = new Intl.DateTimeFormat("es-CO", { month: "long", timeZone: "UTC" });

export function SummaryCard({ summary, today }: { summary: Summary; today: string }) {
  const { week, month } = summary;
  const left = week.income - week.expense;
  const hasIncome = week.income > 0;
  const month_ = monthName.format(new Date(`${today}T12:00:00Z`));

  return (
    <section className="mt-2 rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-border">
      <p className="text-sm text-muted">
        {hasIncome ? "Te quedan esta semana" : "Gastaste esta semana"}
      </p>
      <p
        className={`tabular mt-1 text-4xl font-bold tracking-tight ${
          hasIncome && left < 0 ? "text-danger" : ""
        }`}
      >
        {formatCOP(hasIncome ? left : week.expense)}
      </p>
      <p className="tabular mt-2 text-sm text-muted">
        Entró <span className="text-accent">{formatCOP(week.income)}</span> · Salió{" "}
        <span className="text-foreground">{formatCOP(week.expense)}</span>
      </p>

      <div className="tabular mt-4 flex justify-between border-t border-border pt-3 text-sm">
        <span className="text-muted capitalize">{month_}</span>
        <span>
          <span className="text-accent">+{formatCOP(month.income)}</span>
          <span className="text-muted"> · </span>
          <span>-{formatCOP(month.expense)}</span>
        </span>
      </div>
    </section>
  );
}
