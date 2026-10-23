import { describe, expect, it } from "vitest";
import {
  buildReport,
  deltaRatio,
  nextRange,
  periodRange,
  previousRange,
  type ReportTx,
} from "./report";

const categories = [
  { id: "comida", name: "Comida", emoji: "🍔" },
  { id: "transporte", name: "Transporte", emoji: "🚕" },
];

const tx = (occurred_on: string, amount: number, category_id: string | null, type: ReportTx["type"] = "expense"): ReportTx => ({
  occurred_on,
  amount,
  category_id,
  type,
});

describe("rangos", () => {
  it("la semana va de lunes a domingo", () => {
    expect(periodRange("semana", "2026-10-23")).toEqual({ start: "2026-10-19", end: "2026-10-25" });
    expect(periodRange("semana", "2026-10-25")).toEqual({ start: "2026-10-19", end: "2026-10-25" });
  });

  it("el mes va del 1 al último día, incluso en febrero y diciembre", () => {
    expect(periodRange("mes", "2026-10-23")).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(periodRange("mes", "2028-02-10")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(periodRange("mes", "2026-12-05")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });

  it("navega al periodo anterior y siguiente", () => {
    const week = periodRange("semana", "2026-10-23");
    expect(previousRange("semana", week)).toEqual({ start: "2026-10-12", end: "2026-10-18" });
    expect(nextRange("semana", week)).toEqual({ start: "2026-10-26", end: "2026-11-01" });
    expect(previousRange("mes", periodRange("mes", "2026-01-15"))).toEqual({
      start: "2025-12-01",
      end: "2025-12-31",
    });
  });
});

describe("deltaRatio", () => {
  it("calcula la variación relativa", () => {
    expect(deltaRatio(120, 100)).toBeCloseTo(0.2);
    expect(deltaRatio(50, 100)).toBeCloseTo(-0.5);
  });

  it("devuelve null sin base", () => {
    expect(deltaRatio(100, 0)).toBeNull();
  });
});

describe("buildReport", () => {
  const txs = [
    tx("2026-10-19", 25_000, "comida"),
    tx("2026-10-20", 6_000, "transporte"),
    tx("2026-10-20", 6_000, "transporte"),
    tx("2026-10-21", 200_000, "otra-borrada"),
    tx("2026-10-22", 200_000, null, "income"),
    // Semana anterior
    tx("2026-10-14", 10_000, "comida"),
    tx("2026-10-15", 30_000, "transporte"),
    tx("2026-10-16", 150_000, null, "income"),
    // Fuera de ambos rangos
    tx("2026-09-01", 999_999, "comida"),
  ];
  const report = buildReport("semana", "2026-10-23", "2026-10-23", txs, categories);

  it("suma ingresos y gastos del periodo y del anterior", () => {
    expect(report.expense).toBe(237_000);
    expect(report.income).toBe(200_000);
    expect(report.previousExpense).toBe(40_000);
    expect(report.previousIncome).toBe(150_000);
  });

  it("tiene un elemento por cada día con el gasto diario", () => {
    expect(report.days).toHaveLength(7);
    expect(report.days[1]).toEqual({ day: "2026-10-20", expense: 12_000 });
    expect(report.days[6]).toEqual({ day: "2026-10-25", expense: 0 });
  });

  it("promedia solo los días transcurridos del periodo en curso", () => {
    // Lunes a viernes = 5 días
    expect(report.dailyAverage).toBe(Math.round(237_000 / 5));
  });

  it("agrupa por categoría ordenado de mayor a menor, con lo no reconocido como null", () => {
    expect(report.byCategory.map((c) => c.category?.id ?? null)).toEqual([null, "comida", "transporte"]);
    const transporte = report.byCategory.find((c) => c.category?.id === "transporte")!;
    expect(transporte.amount).toBe(12_000);
    expect(transporte.previous).toBe(30_000);
    expect(transporte.share).toBeCloseTo(12_000 / 237_000);
  });

  it("un periodo pasado promedia sobre todos sus días", () => {
    const past = buildReport("semana", "2026-10-14", "2026-10-23", txs, categories);
    expect(past.dailyAverage).toBe(Math.round(40_000 / 7));
  });
});
