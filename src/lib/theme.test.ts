import { describe, expect, it } from "vitest";
import { DEFAULT_ACCENT, isAccent, parseAccent, parseMode } from "./theme";

describe("tema de acento", () => {
  it("acepta solo las claves conocidas", () => {
    expect(isAccent("brasa")).toBe(true);
    expect(isAccent("verde")).toBe(false);
    expect(isAccent(undefined)).toBe(false);
  });

  it("cae a tinta con valores raros", () => {
    expect(parseAccent("cobalto")).toBe("cobalto");
    expect(parseAccent("<script>")).toBe(DEFAULT_ACCENT);
    expect(DEFAULT_ACCENT).toBe("tinta");
  });
});

describe("modo claro u oscuro", () => {
  it("sigue al sistema por defecto", () => {
    expect(parseMode(undefined)).toBe("system");
    expect(parseMode("dark")).toBe("dark");
    expect(parseMode("oscuro")).toBe("system");
  });
});
