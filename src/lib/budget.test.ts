import { describe, expect, it } from "vitest";
import { budgetStatus } from "./budget";

describe("budgetStatus", () => {
  it("sin ingresos no hay presupuesto", () => {
    expect(budgetStatus(50_000, 0)).toEqual({ ratio: 0, level: "none" });
  });

  it("por debajo del 80% está bien", () => {
    expect(budgetStatus(140_000, 200_000)).toEqual({ ratio: 0.7, level: "ok" });
  });

  it("avisa desde el 80%", () => {
    expect(budgetStatus(160_000, 200_000).level).toBe("warning");
    expect(budgetStatus(199_999, 200_000).level).toBe("warning");
  });

  it("se pasa al llegar al 100%", () => {
    expect(budgetStatus(200_000, 200_000).level).toBe("over");
    expect(budgetStatus(220_000, 200_000)).toEqual({ ratio: 1.1, level: "over" });
  });
});
