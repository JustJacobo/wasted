import { describe, expect, it } from "vitest";
import { budgetMessage, budgetStatus, crossedLevel, weekBefore } from "./budget";

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

describe("budgetMessage", () => {
  const msg = (expense: number, income: number) =>
    budgetMessage(budgetStatus(expense, income), expense, income);

  it("no dice nada sin ingresos", () => {
    expect(msg(10_000, 0)).toBeNull();
  });

  it("cambia de tono según cuánto va", () => {
    expect(msg(40_000, 200_000)).toBe("Vas bien, parce: llevas 20% de lo que entró esta semana");
    expect(msg(120_000, 200_000)).toBe("Ojo, ya va el 60% de lo que entró esta semana");
    expect(msg(170_000, 200_000)).toBe("Frena un poquito: llevas 85% de lo que entró esta semana");
    expect(msg(212_300, 200_000)).toBe("Paila: te pasaste $ 12.300 de lo que entró esta semana");
  });
});

describe("crossedLevel", () => {
  it("dice qué umbral se cruzó con el último movimiento", () => {
    const after = { income: 100_000, expense: 105_000 };
    expect(weekBefore(after, { type: "expense", amount: 10_000 })).toEqual({ income: 100_000, expense: 95_000 });
    expect(crossedLevel(weekBefore(after, { type: "expense", amount: 10_000 }), after)).toBe("over");
    expect(crossedLevel({ income: 100_000, expense: 70_000 }, { income: 100_000, expense: 85_000 })).toBe("warning");
    expect(crossedLevel({ income: 100_000, expense: 110_000 }, { income: 100_000, expense: 120_000 })).toBeNull();
  });
});
