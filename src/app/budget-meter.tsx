import { budgetMessage, budgetStatus } from "@/lib/budget";

/**
 * La mecha: lo que queda de lo que entró en la semana. La línea se acorta al
 * gastar y termina en el punto del logo. Al 80% pasa a ámbar; al 100% no
 * queda línea. El texto dice lo mismo sin depender del color.
 */
export function BudgetMeter({ expense, income }: { expense: number; income: number }) {
  const status = budgetStatus(expense, income);
  const message = budgetMessage(status, expense, income);
  if (!message) return null;

  const { ratio, level } = status;
  const left = Math.max(0, 1 - ratio);
  const line = level === "warning" ? "bg-viz-warn" : "bg-foreground";
  const dot = level === "over" ? "bg-viz-over" : level === "warning" ? "bg-viz-warn" : "bg-accent";
  const move = "transition-transform duration-500 ease-ui motion-reduce:transition-none";

  return (
    <div className="mt-5">
      <div
        role="meter"
        aria-label="Lo que te queda de lo que entró esta semana"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(left * 100)}
        // Margen de medio punto a cada lado para que el punto no se recorte.
        className="relative h-3 overflow-hidden"
      >
        <div className="absolute inset-y-0 right-1.5 left-1.5">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
          <div
            className={`absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 origin-left ${line} ${move}`}
            style={{ transform: `translateY(-50%) scaleX(${left})` }}
          />
          <div className={`absolute inset-0 ${move}`} style={{ transform: `translateX(${left * 100}%)` }}>
            <span
              data-mecha-dot
              className={`absolute top-1/2 left-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${dot}`}
            />
          </div>
        </div>
      </div>
      <p className={`mt-2 text-sm ${level === "ok" ? "text-muted" : "text-foreground"}`}>
        {message}
      </p>
    </div>
  );
}
