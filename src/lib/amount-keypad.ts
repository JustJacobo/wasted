export type KeypadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "000" | "back";

/** Hasta $999.999.999.999: más que suficiente y evita desbordar la pantalla. */
export const MAX_DIGITS = 12;

/**
 * Aplica una tecla del teclado numérico al monto, guardado como string de
 * dígitos sin ceros a la izquierda ("" equivale a 0).
 */
export function pressKey(digits: string, key: KeypadKey): string {
  if (key === "back") return digits.slice(0, -1);
  const next = (digits + key).replace(/^0+/, "");
  return next.length > MAX_DIGITS ? digits : next;
}
