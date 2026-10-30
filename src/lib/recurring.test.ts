import { describe, expect, it } from "vitest";
import { addMonths, daysBetween, lastDayOfMonth } from "./dates";
import {
  dueDates,
  firstOnOrAfter,
  frequencyLabel,
  nextAfter,
  occurrence,
  type Frequency,
} from "./recurring";

const weekly: Frequency = { every: 1, unit: "week" };
const biweekly: Frequency = { every: 2, unit: "week" };
const monthly: Frequency = { every: 1, unit: "month" };
const yearly: Frequency = { every: 1, unit: "year" };

describe("fechas de calendario", () => {
  it("suma meses y cae el último día si el mes es más corto", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-10-15", 3)).toBe("2027-01-15");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(lastDayOfMonth("2026-12-05")).toBe("2026-12-31");
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
  });
});

describe("serie de un recurrente", () => {
  it("semanal y cada 2 semanas", () => {
    expect(occurrence("2026-10-26", weekly, 1)).toBe("2026-11-02");
    expect(occurrence("2026-10-26", biweekly, 2)).toBe("2026-11-23");
  });

  it("un mensual del 31 no se corre después de un mes corto", () => {
    const dates = [0, 1, 2, 3, 4, 5].map((k) => occurrence("2026-10-31", monthly, k));
    expect(dates).toEqual(["2026-10-31", "2026-11-30", "2026-12-31", "2027-01-31", "2027-02-28", "2027-03-31"]);
    expect(nextAfter("2026-10-31", monthly, "2026-11-30")).toBe("2026-12-31");
  });

  it("un anual del 29 de febrero cae el 28 en años no bisiestos", () => {
    expect(occurrence("2028-02-29", yearly, 1)).toBe("2029-02-28");
    expect(occurrence("2028-02-29", yearly, 4)).toBe("2032-02-29");
  });

  it("cada 10 días", () => {
    expect(nextAfter("2026-10-01", { every: 10, unit: "day" }, "2026-10-21")).toBe("2026-10-31");
  });

  it("la siguiente fecha justo en la fecha y justo antes", () => {
    expect(nextAfter("2026-10-01", monthly, "2026-11-01")).toBe("2026-12-01");
    expect(nextAfter("2026-10-01", monthly, "2026-10-31")).toBe("2026-11-01");
    expect(firstOnOrAfter("2026-10-01", monthly, "2026-11-01")).toBe("2026-11-01");
    expect(firstOnOrAfter("2026-10-26", weekly, "2026-10-01")).toBe("2026-10-26");
  });

  it("al reanudar arranca en la próxima fecha, sin lo de la pausa", () => {
    expect(firstOnOrAfter("2026-01-05", weekly, "2026-10-30")).toBe("2026-11-02");
    expect(firstOnOrAfter("2025-01-15", { every: 3, unit: "month" }, "2026-10-30")).toBe("2027-01-15");
  });
});

describe("lo vencido", () => {
  it("devuelve lo atrasado y la siguiente fecha", () => {
    const rule = { starts_on: "2026-10-05", next_on: "2026-10-19", ...weekly };
    expect(dueDates(rule, "2026-10-30")).toEqual({
      dates: ["2026-10-19", "2026-10-26"],
      nextOn: "2026-11-02",
    });
  });

  it("nada si todavía no vence", () => {
    const rule = { starts_on: "2026-10-01", next_on: "2026-11-01", ...monthly };
    expect(dueDates(rule, "2026-10-30")).toEqual({ dates: [], nextOn: "2026-11-01" });
  });

  it("con mucho atraso se queda con las últimas 12", () => {
    const rule = { starts_on: "2026-01-01", next_on: "2026-01-01", every: 1, unit: "day" as const };
    const { dates, nextOn } = dueDates(rule, "2026-10-30");
    expect(dates).toHaveLength(12);
    expect(dates.at(-1)).toBe("2026-10-30");
    expect(dates[0]).toBe("2026-10-19");
    expect(nextOn).toBe("2026-10-31");
  });
});

describe("textos", () => {
  it("describe cada frecuencia", () => {
    expect(frequencyLabel("2026-10-26", weekly)).toBe("Cada lunes");
    expect(frequencyLabel("2026-10-31", biweekly)).toBe("Cada 2 semanas, los sábados");
    expect(frequencyLabel("2026-10-15", monthly)).toBe("Cada mes, el día 15");
    expect(frequencyLabel("2026-10-31", { every: 3, unit: "month" })).toBe("Cada 3 meses, el último día");
    expect(frequencyLabel("2027-03-03", yearly)).toBe("Cada año, el 3 de marzo");
    expect(frequencyLabel("2026-10-01", { every: 1, unit: "day" })).toBe("Cada día");
    expect(frequencyLabel("2026-10-01", { every: 10, unit: "day" })).toBe("Cada 10 días");
  });
});
