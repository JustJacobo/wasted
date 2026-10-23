import { formatCOP, sizeForLength } from "@/lib/money";
import type { Report } from "@/lib/report";
import { Delta } from "./delta";

/** Cifra protagonista (gasto) y tarjetas de ingresos, balance y promedio diario. */
export function StatTiles({ report, periodName }: { report: Report; periodName: string }) {
  const balance = report.income - report.expense;

  return (
    <div className="space-y-3">
      <section className="rounded-3xl bg-surface p-5 ring-1 ring-border">
        <p className="text-sm text-muted">Gastaste</p>
        {/* Cifras proporcionales en el número grande; tabulares solo en columnas. */}
        <p
          className={`mt-1 font-bold tracking-tight ${sizeForLength(
            formatCOP(report.expense),
            [
              [11, "text-5xl"],
              [13, "text-4xl"],
              [15, "text-3xl"],
            ],
            "text-2xl",
          )}`}
        >
          {formatCOP(report.expense)}
        </p>
        <p className="mt-2">
          <Delta
            current={report.expense}
            previous={report.previousExpense}
            upIsGood={false}
            periodName={periodName}
          />
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Tile label="Ingresos" value={formatCOP(report.income)}>
          <Delta
            current={report.income}
            previous={report.previousIncome}
            upIsGood
            periodName={periodName}
          />
        </Tile>
        <Tile
          label="Balance"
          value={`${balance < 0 ? "-" : "+"}${formatCOP(Math.abs(balance))}`}
        >
          <span className="text-xs text-muted">
            {balance >= 0 ? "Ahorraste la diferencia" : "Gastaste más de lo que entró"}
          </span>
        </Tile>
        <Tile label="Promedio diario" value={formatCOP(report.dailyAverage)} wide>
          <span className="text-xs text-muted">de gasto en los días transcurridos</span>
        </Tile>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  wide,
  children,
}: {
  label: string;
  value: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`min-w-0 rounded-2xl bg-surface p-4 ring-1 ring-border ${wide ? "col-span-2" : ""}`}
    >
      <p className="text-sm text-muted">{label}</p>
      <p
        className={`mt-1 font-semibold tracking-tight break-all ${sizeForLength(
          value,
          [
            [11, "text-xl"],
            [14, "text-lg"],
            [17, "text-base"],
          ],
          "text-sm",
        )}`}
      >
        {value}
      </p>
      <p className="mt-1">{children}</p>
    </section>
  );
}
