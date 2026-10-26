import { createHash, randomBytes } from "node:crypto";

/** Prefijo de las claves de atajos: se reconoce a simple vista y en un escáner de secretos. */
export const TOKEN_PREFIX = "wst_";

/** Clave nueva para atajos y widgets. Se muestra una sola vez; en la BD queda su hash. */
export const newToken = () => `${TOKEN_PREFIX}${randomBytes(24).toString("base64url")}`;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** La clave de `Authorization: Bearer wst_…`, o null si falta o no tiene la forma esperada. */
export function bearerToken(header: string | null): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header?.trim() ?? "");
  const token = match?.[1];
  return token && token.startsWith(TOKEN_PREFIX) && token.length <= 64 ? token : null;
}
