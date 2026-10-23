import { deltaRatio } from "@/lib/report";

const percent = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 0 });

/**
 * Variación frente al periodo anterior. La flecha lleva el color (verde si el
 * cambio es bueno, rojo si es malo) y el texto queda en tinta neutra, así la
 * información nunca depende solo del color.
 */
export function Delta({
  current,
  previous,
  upIsGood,
  periodName,
}: {
  current: number;
  previous: number;
  upIsGood: boolean;
  periodName: string;
}) {
  const ratio = deltaRatio(current, previous);
  if (ratio === null) {
    return <span className="text-xs text-muted">Sin datos {periodName}</span>;
  }
  if (Math.abs(ratio) < 0.005) {
    return <span className="text-xs text-muted">Igual que {periodName}</span>;
  }

  const up = ratio > 0;
  const good = up === upIsGood;
  return (
    <span className="text-xs text-muted">
      <span aria-hidden className={`mr-1 ${good ? "text-accent" : "text-danger"}`}>
        {up ? "▲" : "▼"}
      </span>
      <span className="sr-only">{up ? "Subió" : "Bajó"}</span>
      <span className="text-foreground">
        {Math.abs(ratio) > 9.99 ? "más de 999%" : percent.format(Math.abs(ratio))}
      </span>{" "}
      vs {periodName}
    </span>
  );
}
