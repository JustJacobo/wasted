import { describe, expect, it } from "vitest";
import { bearerToken, hashToken, newToken, TOKEN_PREFIX } from "./api-token";

describe("clave de atajos", () => {
  it("genera claves distintas con prefijo y largo fijo", () => {
    const a = newToken();
    expect(a.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(a).toHaveLength(TOKEN_PREFIX.length + 32);
    expect(newToken()).not.toBe(a);
  });

  it("guarda un hash estable que no revela la clave", () => {
    const token = newToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });

  it("lee la clave del encabezado Authorization", () => {
    const token = newToken();
    expect(bearerToken(`Bearer ${token}`)).toBe(token);
    expect(bearerToken(`bearer   ${token}  `)).toBe(token);
  });

  it("rechaza encabezados vacíos o con otra forma", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("")).toBeNull();
    expect(bearerToken("Bearer")).toBeNull();
    expect(bearerToken("Bearer abc123")).toBeNull();
    expect(bearerToken(newToken())).toBeNull();
    expect(bearerToken(`Bearer ${newToken()} extra`)).toBeNull();
    expect(bearerToken(`Bearer wst_${"a".repeat(100)}`)).toBeNull();
  });
});
