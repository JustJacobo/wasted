/**
 * Patrón para `ilike` que busca el texto tal cual: escapa los comodines de
 * LIKE (`%`, `_`) y la barra invertida, y colapsa espacios.
 */
export function likePattern(query: string): string {
  const clean = query.trim().replace(/\s+/g, " ");
  return `%${clean.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Ruta interna segura para volver después de editar. Rechaza URLs externas
 * ("//evil.com", "https://…") para evitar redirecciones abiertas.
 */
export function safeReturnPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
