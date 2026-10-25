/**
 * Colores de categoría para el dashboard. Paleta categórica de la skill
 * `dataviz`, validada en modo claro y oscuro sobre las superficies de la app;
 * los valores viven en globals.css (--cat-<clave>). El orden importa: la
 * separación para daltonismo se validó entre colores vecinos en este orden.
 * Sin color (null) = gris neutro, el de "Varios" y "Otros".
 */
export const CATEGORY_COLORS = {
  azul: "Azul",
  naranja: "Naranja",
  aqua: "Aguamarina",
  amarillo: "Amarillo",
  magenta: "Magenta",
  verde: "Verde",
  violeta: "Violeta",
  rojo: "Rojo",
} as const;

export type CategoryColor = keyof typeof CATEGORY_COLORS;

export const CATEGORY_COLOR_KEYS = Object.keys(CATEGORY_COLORS) as [CategoryColor, ...CategoryColor[]];

export function isCategoryColor(value: unknown): value is CategoryColor {
  return typeof value === "string" && value in CATEGORY_COLORS;
}

/** Valor CSS del color; gris neutro si no tiene. */
export function categoryColorVar(color: string | null | undefined): string {
  return `var(--cat-${isCategoryColor(color) ? color : "gris"})`;
}

/**
 * Color para una categoría nueva: el menos usado entre las demás del mismo
 * tipo y, a igualdad, el primero en el orden de la paleta.
 */
export function nextCategoryColor(used: (string | null | undefined)[]): CategoryColor {
  const counts = new Map<CategoryColor, number>(CATEGORY_COLOR_KEYS.map((k) => [k, 0]));
  for (const color of used) {
    if (isCategoryColor(color)) counts.set(color, counts.get(color)! + 1);
  }
  const fewest = Math.min(...counts.values());
  return CATEGORY_COLOR_KEYS.find((k) => counts.get(k) === fewest)!;
}
