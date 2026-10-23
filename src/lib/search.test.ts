import { describe, expect, it } from "vitest";
import { likePattern, safeReturnPath } from "./search";

describe("likePattern", () => {
  it("envuelve el texto para buscar en cualquier parte", () => {
    expect(likePattern("uber")).toBe("%uber%");
  });

  it("escapa los comodines de LIKE", () => {
    expect(likePattern("50%")).toBe("%50\\%%");
    expect(likePattern("a_b")).toBe("%a\\_b%");
    expect(likePattern("c:\\x")).toBe("%c:\\\\x%");
  });

  it("recorta y colapsa espacios", () => {
    expect(likePattern("  pasaje   bus ")).toBe("%pasaje bus%");
  });
});

describe("safeReturnPath", () => {
  it("acepta rutas internas con parámetros", () => {
    expect(safeReturnPath("/movimientos?mes=2026-10&q=uber")).toBe("/movimientos?mes=2026-10&q=uber");
  });

  it("rechaza destinos externos o raros", () => {
    expect(safeReturnPath("//evil.com")).toBe("/");
    expect(safeReturnPath("https://evil.com")).toBe("/");
    expect(safeReturnPath("/\\evil.com")).toBe("/");
    expect(safeReturnPath(undefined)).toBe("/");
    expect(safeReturnPath(42)).toBe("/");
  });
});
