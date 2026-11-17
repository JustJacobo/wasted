import { describe, expect, it } from "vitest";
import { chargeKey, chargeName, dueLabel, findCharge, matchingCharges, payableCharges, payableForRule, payDate } from "./recurring-suggest";
import type { UpcomingCharge } from "./week-plan";

const charge = (changes: Partial<UpcomingCharge>): UpcomingCharge => ({
  day: "2026-11-17",
  type: "expense",
  amount: 45000,
  description: "Netflix",
  categoryId: "c1",
  ruleId: "r1",
  pending: false,
  txId: null,
  occurrence: "2026-11-17",
  ...changes,
});

describe("recurrentes que se pueden marcar pagados", () => {
  it("ofrece solo la próxima fecha de cada recurrente y del tipo pedido", () => {
    const items = payableCharges(
      [
        charge({ ruleId: "d", day: "2026-11-17", occurrence: "2026-11-17" }),
        charge({ ruleId: "d", day: "2026-11-19", occurrence: "2026-11-19" }),
        charge({ ruleId: "cuota", type: "income", day: "2026-11-18" }),
      ],
      "expense",
    );
    expect(items.map(chargeKey)).toEqual(["d:2026-11-17"]);
  });

  it("pone primero lo que espera en la bandeja y no ofrece la fecha futura de ese recurrente", () => {
    const items = payableCharges(
      [
        charge({ ruleId: "a", day: "2026-11-17" }),
        charge({ ruleId: "b", day: "2026-11-15", occurrence: "2026-11-15", pending: true, txId: "t1" }),
        charge({ ruleId: "b", day: "2026-11-22", occurrence: "2026-11-22" }),
      ],
      "expense",
    );
    expect(items.map((c) => [c.ruleId, c.pending])).toEqual([
      ["b", true],
      ["a", false],
    ]);
  });

  it("muestra a lo sumo tres, los más cercanos", () => {
    const items = payableCharges(
      ["r1", "r2", "r3", "r4"].map((ruleId, i) => charge({ ruleId, day: `2026-11-2${i}`, occurrence: `2026-11-2${i}` })),
      "expense",
    );
    expect(items.map((c) => c.ruleId)).toEqual(["r1", "r2", "r3"]);
  });

  it("con un monto escrito, sugiere los de monto parecido, el más cercano primero", () => {
    const upcoming = [
      charge({ ruleId: "netflix", amount: 45000 }),
      charge({ ruleId: "gym", amount: 50000, day: "2026-11-18", occurrence: "2026-11-18" }),
      charge({ ruleId: "arriendo", amount: 1200000, day: "2026-11-19", occurrence: "2026-11-19" }),
    ];
    expect(matchingCharges(upcoming, "expense", 49000).map((c) => c.ruleId)).toEqual(["gym", "netflix"]);
    expect(matchingCharges(upcoming, "expense", 1200000).map((c) => c.ruleId)).toEqual(["arriendo"]);
    expect(matchingCharges(upcoming, "expense", 7000)).toEqual([]);
    expect(matchingCharges(upcoming, "expense", 0)).toEqual([]);
  });

  it("dice cuándo vence", () => {
    const today = "2026-11-17";
    expect(dueLabel({ pending: true, day: "2026-11-15" }, today)).toBe("Por confirmar");
    expect(dueLabel({ pending: false, day: today }, today)).toBe("Vence hoy");
    expect(dueLabel({ pending: false, day: "2026-11-18" }, today)).toBe("Mañana");
    expect(dueLabel({ pending: false, day: "2026-11-20" }, today)).toBe("20 nov");
  });

  it("desde un acceso directo paga lo pendiente de ese recurrente antes que la fecha futura", () => {
    const upcoming = [
      charge({ ruleId: "b", day: "2026-11-22", occurrence: "2026-11-22" }),
      charge({ ruleId: "b", day: "2026-11-15", occurrence: "2026-11-15", pending: true, txId: "t1" }),
    ];
    expect(payableForRule(upcoming, "b")?.txId).toBe("t1");
    expect(payableForRule(upcoming, "x")).toBeNull();
    // La fila que se tocó manda.
    expect(findCharge(upcoming, "b", "2026-11-22")?.occurrence).toBe("2026-11-22");
    expect(findCharge(upcoming, "b", "2026-12-01")?.txId).toBe("t1");
  });

  it("registra un pendiente en su fecha y lo adelantado hoy", () => {
    const today = "2026-11-17";
    expect(payDate({ pending: true, day: "2026-11-10" }, today)).toBe("2026-11-10");
    expect(payDate({ pending: false, day: "2026-11-22" }, today)).toBe(today);
  });

  it("nombra la ficha con la descripción, la categoría o Recurrente", () => {
    expect(chargeName({ description: "Netflix" }, { name: "Suscripciones" })).toBe("Netflix");
    expect(chargeName({ description: "" }, { name: "Suscripciones" })).toBe("Suscripciones");
    expect(chargeName({ description: "" })).toBe("Recurrente");
  });
});
