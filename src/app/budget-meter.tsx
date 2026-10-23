import { budgetStatus, type BudgetStatus } from "@/lib/budget";
import { formatCOP } from "@/lib/money";

const percent = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 0 });

/** Texto del estado del presupuesto; null si no hay nada que decir. */
export function budgetMessage(
  { ratio, level }: BudgetStatus,
  expense: number,
  income: number,
): string | null {
  if (level === "none") return null;
  if (level === "over") return `Te pasaste ${formatCOP(expense - income)} de lo que entró`;
  return `Llevas ${percent.format(ratio)} de lo que entró`;
}

/**
 * Barra de lo gastado frente a lo que entró en la semana. El relleno cambia de
 * tono al 80% y al 100%, y el texto con ⚠️ dice lo mismo sin depender del color.
 */
export function BudgetMeter({ expense, income }: { expense: number; income: number }) {
  const status = budgetStatus(expense, income);
  const message = budgetMessage(status, expense, income);
  if (!message) return null;

  const { ratio, level } = status;
  const fill = level === "over" ? "bg-viz-over" : level === "warning" ? "bg-viz-warn" : "bg-viz";
  const track =
    level === "over" ? "bg-viz-over/15" : level === "warning" ? "bg-viz-warn/15" : "bg-viz/15";

  return (
    <div className="mt-4">
      <div
        role="meter"
        aria-label="Gastado de lo que entró esta semana"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(ratio, 1) * 100)}
        className={`h-2 overflow-hidden ${track}`}
      >
        <div
          className={`h-full origin-left rounded-r-[4px] transition-transform duration-300 ease-ui motion-reduce:transition-none ${fill}`}
          style={{ transform: `scaleX(${Math.min(ratio, 1)})` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {level !== "ok" && (
          <span aria-hidden className="mr-1">
            ⚠️
          </span>
        )}
        <span className={level === "ok" ? "" : "text-foreground"}>{message}</span>
      </p>
    </div>
  );
}
