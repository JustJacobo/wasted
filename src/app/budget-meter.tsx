import { budgetMessage, budgetStatus } from "@/lib/budget";
import type { WeekBudget } from "@/lib/types";
import { RefillMark } from "./refill-mark";

/**
 * La mecha: lo que queda de lo disponible en la semana (saldo anterior + lo que
 * entró). La línea se acorta al gastar y termina en el punto del logo. Al 80% pasa a ámbar; al 100% no
 * queda línea. El texto dice lo mismo sin depender del color.
 *
 * `refillWeek`: primera vez que se ve esta semana con saldo; la mecha se
 * llena desde cero (animación CSS desde el primer pintado, sin parpadeo).
 */
export function BudgetMeter({ week, refillWeek }: { week: WeekBudget; refillWeek?: string }) {
  const status = budgetStatus(week);
  const message = budgetMessage(status, week);
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
        aria-label="Lo que te queda de lo disponible esta semana"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(left * 100)}
        // Margen de medio punto a cada lado para que el punto no se recorte.
        className="relative h-3 overflow-hidden"
      >
        <div className="absolute inset-y-0 right-1.5 left-1.5">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
          <div
            className={`absolute inset-x-0 top-[3px] h-1.5 origin-left ${line} ${move} ${refillWeek ? "mecha-refill-line" : ""}`}
            style={{ transform: `scaleX(${left})` }}
          />
          <div
            className={`absolute inset-0 ${move} ${refillWeek ? "mecha-refill-dot" : ""}`}
            style={{ transform: `translateX(${left * 100}%)` }}
          >
            <span
              data-mecha-dot
              className={`absolute top-1/2 left-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${dot}`}
            />
          </div>
        </div>
      </div>
      {refillWeek && <RefillMark week={refillWeek} />}
      <p className={`mt-2 text-sm ${level === "ok" ? "text-muted" : "text-foreground"}`}>
        {message}
      </p>
    </div>
  );
}
