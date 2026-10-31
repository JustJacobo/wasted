import { describe, expect, it } from "vitest";
import { available, balance, budgetMessage, budgetStatus, crossedLevel, weekBefore } from "./budget";

const week = (expense: number, income: number, carry = 0, moved = 0) => ({ expense, income, carry, moved });

describe("budgetStatus", () => {
  it("sin ingresos ni saldo anterior no hay presupuesto", () => {
    expect(budgetStatus(week(50_000, 0))).toEqual({ ratio: 0, level: "none" });
  });

  it("por debajo del 80% está bien", () => {
    expect(budgetStatus(week(140_000, 200_000))).toEqual({ ratio: 0.7, level: "ok" });
  });

  it("avisa desde el 80%", () => {
    expect(budgetStatus(week(160_000, 200_000)).level).toBe("warning");
    expect(budgetStatus(week(199_999, 200_000)).level).toBe("warning");
  });

  it("se pasa al llegar al 100%", () => {
    expect(budgetStatus(week(200_000, 200_000)).level).toBe("over");
    expect(budgetStatus(week(220_000, 200_000))).toEqual({ ratio: 1.1, level: "over" });
  });

  it("lo que sobró la semana anterior agranda lo disponible", () => {
    const w = week(200_000, 200_000, 50_000);
    expect(available(w)).toBe(250_000);
    expect(balance(w)).toBe(50_000);
    expect(budgetStatus(w)).toEqual({ ratio: 0.8, level: "warning" });
    expect(budgetStatus(week(40_000, 0, 50_000))).toEqual({ ratio: 0.8, level: "warning" });
  });

  it("lo que faltó la semana anterior lo achica", () => {
    expect(budgetStatus(week(90_000, 200_000, -100_000))).toEqual({ ratio: 0.9, level: "warning" });
  });

  it("si se arrastra deuda y no ha entrado nada, ya está pasado", () => {
    expect(budgetStatus(week(0, 0, -20_000))).toEqual({ ratio: 1, level: "over" });
    expect(budgetStatus(week(0, 10_000, -20_000)).level).toBe("over");
  });
});

describe("budgetMessage", () => {
  const msg = (expense: number, income: number, carry = 0) =>
    budgetMessage(budgetStatus(week(expense, income, carry)), week(expense, income, carry));

  it("no dice nada sin presupuesto", () => {
    expect(msg(10_000, 0)).toBeNull();
  });

  it("cambia de tono según cuánto va", () => {
    expect(msg(40_000, 200_000)).toBe("Vas bien: llevas 20% de lo disponible esta semana");
    expect(msg(120_000, 200_000)).toBe("Ya llevas el 60% de lo disponible esta semana");
    expect(msg(170_000, 200_000)).toBe("Cuidado: llevas 85% de lo disponible esta semana");
    expect(msg(212_300, 200_000)).toBe("Te pasaste $ 12.300 de lo disponible esta semana");
  });

  it("sin saldo de sobra ni de menos, no dice que se pasó $0", () => {
    expect(msg(200_000, 200_000)).toBe("Ya usaste todo lo disponible esta semana");
    expect(msg(0, 20_000, -20_000)).toBe("Ya usaste todo lo disponible esta semana");
  });

  it("cuenta el saldo anterior", () => {
    expect(msg(170_000, 200_000, 50_000)).toBe("Ya llevas el 68% de lo disponible esta semana");
    expect(msg(0, 0, -20_000)).toBe("Te pasaste $ 20.000 de lo disponible esta semana");
  });
});

describe("crossedLevel", () => {
  it("dice qué umbral se cruzó con el último movimiento", () => {
    const after = week(105_000, 100_000);
    expect(weekBefore(after, { type: "expense", amount: 10_000 })).toEqual(week(95_000, 100_000));
    expect(crossedLevel(weekBefore(after, { type: "expense", amount: 10_000 }), after)).toBe("over");
    expect(crossedLevel(week(70_000, 100_000), week(85_000, 100_000))).toBe("warning");
    expect(crossedLevel(week(110_000, 100_000), week(120_000, 100_000))).toBeNull();
  });

  it("con saldo anterior, el umbral se mueve", () => {
    expect(crossedLevel(week(70_000, 100_000, 50_000), week(85_000, 100_000, 50_000))).toBeNull();
    expect(crossedLevel(week(110_000, 100_000, 50_000), week(125_000, 100_000, 50_000))).toBe("warning");
  });

  it("weekBefore conserva el saldo anterior", () => {
    expect(weekBefore(week(0, 30_000, 5_000), { type: "income", amount: 30_000 })).toEqual(week(0, 0, 5_000));
  });
});
