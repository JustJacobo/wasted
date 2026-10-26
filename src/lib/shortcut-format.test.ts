import { describe, expect, it } from "vitest";
import { balanceSnapshot, shortcutSavedText } from "./shortcut-format";

// Intl separa "$" del número con un espacio duro.
const $ = (n: string) => `$ ${n}`;
const week = (expense: number, income: number, carry = 0) => ({ expense, income, carry });
const TODAY = "2026-10-26";
const expense = { type: "expense" as const, amount: 6000, description: "uber", occurred_on: TODAY };

describe("confirmación de un atajo", () => {
  it("muestra el monto, la categoría y lo que queda", () => {
    expect(shortcutSavedText(expense, { emoji: "🚕", name: "Transporte" }, TODAY, week(6000, 0, 100_000))).toBe(
      `✓ Gasto ${$("6.000")} · uber\n🚕 Transporte\nTe quedan ${$("94.000")}`,
    );
  });

  it("dice el día si no es hoy y no inventa categoría", () => {
    const text = shortcutSavedText({ ...expense, occurred_on: "2026-10-25" }, undefined, TODAY, week(6000, 0));
    expect(text).toContain("Sin categoría · Ayer");
    expect(text).not.toContain("Te quedan");
  });

  it("avisa en gastos desde el 80%, no en ingresos", () => {
    expect(shortcutSavedText(expense, undefined, TODAY, week(85_000, 100_000))).toContain(
      "⚠️ Cuidado: llevas 85% de lo disponible esta semana",
    );
    expect(shortcutSavedText(expense, undefined, TODAY, week(120_000, 100_000))).toContain(
      `⚠️ Te pasaste ${$("20.000")}`,
    );
    const income = { ...expense, type: "income" as const, description: "cuota semanal" };
    const text = shortcutSavedText(income, undefined, TODAY, week(85_000, 100_000));
    expect(text).toContain(`✓ Ingreso ${$("6.000")} · cuota semanal`);
    expect(text).not.toContain("⚠️");
  });
});

describe("saldo para widgets", () => {
  it("resume el saldo con el anterior y la semana", () => {
    const s = balanceSnapshot(week(50_000, 200_000, 30_000));
    expect(s).toMatchObject({
      teQuedan: 180_000,
      saldoAnterior: 30_000,
      disponible: 230_000,
      semana: { entro: 200_000, salio: 50_000 },
      porcentaje: 0.22,
      nivel: "ok",
      titulo: "Te quedan",
      cifra: $("180.000"),
    });
    expect(s.mensaje).toBe(
      [
        `Te quedan: ${$("180.000")}`,
        `Esta semana entró ${$("200.000")} · salió ${$("50.000")}`,
        "Vas bien: llevas 22% de lo disponible esta semana",
      ].join("\n"),
    );
  });

  it("saldo negativo", () => {
    const s = balanceSnapshot(week(20_000, 0, -10_000));
    expect(s.teQuedan).toBe(-30_000);
    expect(s.cifra).toBe(`-${$("30.000")}`);
    expect(s.nivel).toBe("over");
  });

  it("sin ingresos ni saldo anterior muestra lo gastado", () => {
    const s = balanceSnapshot(week(12_000, 0));
    expect(s).toMatchObject({ nivel: "none", titulo: "Gastaste esta semana", teQuedan: 12_000 });
    expect(s.mensaje.split("\n")).toHaveLength(2);
  });
});
