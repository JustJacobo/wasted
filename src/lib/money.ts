const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** 25000 → "$ 25.000" */
export function formatCOP(amount: number): string {
  return cop.format(amount);
}

/** Versión compacta para gráficos y totales: 25000 → "$25k", 3500000 → "$3,5M". */
export function formatCOPShort(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}$${m.toLocaleString("es-CO", { maximumFractionDigits: 1 })}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}$${k.toLocaleString("es-CO", { maximumFractionDigits: 1 })}k`;
  }
  return `${sign}$${abs}`;
}
