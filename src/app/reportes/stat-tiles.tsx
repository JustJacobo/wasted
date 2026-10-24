import { formatCOP, sizeForLength } from "@/lib/money";
import type { Report } from "@/lib/report";
import { Delta } from "./delta";

/** Cifra protagonista (gasto) y, debajo, ingresos, balance y promedio diario separados por líneas finas. */
export function StatTiles({ report, periodName }: { report: Report; periodName: string }) {
  const balance = report.income - report.expense;

  return (
    <div className="space-y-6">
      <section className="pt-2">
        <p className="text-sm text-muted">Gastaste</p>
        {/* Cifras proporcionales en el número grande; tabulares solo en columnas. */}
        <p
          className={`mt-1 font-semibold tracking-[-0.045em] ${sizeForLength(
            formatCOP(report.expense),
            [
              [11, "text-6xl"],
              [14, "text-5xl"],
              [16, "text-4xl"],
            ],
            "text-3xl",
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

      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
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
      className={`min-w-0 border-t border-border pt-3 ${wide ? "col-span-2" : ""}`}
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
