import { describe, expect, it } from "vitest";
import { MAX_DIGITS, pressKey, type KeypadKey } from "./amount-keypad";

const type = (keys: KeypadKey[]) => keys.reduce(pressKey, "");

describe("pressKey", () => {
  it("arma el monto dígito a dígito", () => {
    expect(type(["2", "5", "000"])).toBe("25000");
    expect(type(["1", "5", "0", "0"])).toBe("1500");
  });

  it("no permite ceros a la izquierda", () => {
    expect(type(["0"])).toBe("");
    expect(type(["000"])).toBe("");
    expect(type(["0", "000", "7"])).toBe("7");
  });

  it("borra el último dígito", () => {
    expect(type(["2", "5", "000", "back"])).toBe("2500");
    expect(type(["back"])).toBe("");
  });

  it("no pasa del máximo de dígitos", () => {
    const full = "9".repeat(MAX_DIGITS);
    expect(pressKey(full, "1")).toBe(full);
    expect(pressKey("9".repeat(MAX_DIGITS - 2), "000")).toBe("9".repeat(MAX_DIGITS - 2));
  });
});
