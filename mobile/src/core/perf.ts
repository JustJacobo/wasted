// Marcas de tiempo del arranque, solo en desarrollo: cuánto tarda cada paso
// desde que carga el JS hasta que el inicio pinta con datos. Se leen en Metro.

const start = Date.now();
const seen = new Set<string>();

/** Registra la primera vez que pasa algo ("sesión lista", "inicio con datos"), con un detalle opcional. */
export function mark(label: string, detail?: string) {
  if (!__DEV__ || seen.has(label)) return;
  seen.add(label);
  console.log(`[arranque] ${label}${detail ? ` (${detail})` : ""}: ${Date.now() - start} ms`);
}
