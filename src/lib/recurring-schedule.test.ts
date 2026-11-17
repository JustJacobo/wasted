import { describe, expect, it } from "vitest";
import type { Recurring } from "./recurring";
import { schedule, scheduleLabel } from "./recurring-schedule";
import type { LinkedCharge } from "./week-plan";

// Noviembre de 2026; hoy es el martes 17.
const FROM = "2026-11-01";
const TO = "2026-11-30";
const TODAY = "2026-11-17";

const rule = (changes: Partial<Recurring>): Recurring => ({
  id: "r1",
  type: "expense",
  amount: 45000,
  description: "Netflix",
  category_id: "c1",
  every: 1,
  unit: "month",
  starts_on: "2026-08-20",
  next_on: "2026-11-20",
  paused: false,
  match_hint: null,
  ...changes,
});

const tx = (changes: Partial<LinkedCharge>): LinkedCharge => ({
  id: "t1",
  recurring_id: "r1",
  status: "confirmed",
  type: "expense",
  amount: 45000,
  description: "Netflix",
  category_id: "c1",
  occurred_on: "2026-11-20",
  ...changes,
});

const summary = (s: ReturnType<typeof schedule>) => s.items.map((c) => [c.ruleId, c.occurrence, c.status, c.payable]);

describe("pagos fijos del mes", () => {
  it("una fecha futura es la próxima a pagar", () => {
    const s = schedule([rule({})], [], FROM, TO, TODAY);
    expect(summary(s)).toEqual([["r1", "2026-11-20", "upcoming", true]]);
    expect(s.expense).toEqual({ total: 45000, paid: 0, left: 45000 });
  });

  it("lo ya registrado sale pagado, con su fecha y su monto", () => {
    const s = schedule([rule({ next_on: "2026-12-20" })], [tx({ occurred_on: "2026-11-19", amount: 46900 })], FROM, TO, TODAY);
    expect(s.items[0]).toMatchObject({ status: "paid", day: "2026-11-19", amount: 46900, txId: "t1", payable: false });
    expect(s.expense).toEqual({ total: 46900, paid: 46900, left: 0 });
  });

  it("un pago adelantado se une a la fecha que cubre aunque esté lejos", () => {
    const linked = [tx({ occurred_on: "2026-11-10", paid_occurrence: "2026-11-20" })];
    const s = schedule([rule({ next_on: "2026-12-20" })], linked, FROM, TO, TODAY);
    expect(summary(s)).toEqual([["r1", "2026-11-20", "paid", false]]);
  });

  it("un pendiente se puede marcar pagado; una fecha pasada sin movimiento quedó omitida", () => {
    const weekly = rule({ id: "w", every: 1, unit: "week", starts_on: "2026-11-02", next_on: "2026-11-23", amount: 200000, type: "income", description: "Cuota" });
    const linked = [
      tx({ id: "a", recurring_id: "w", type: "income", amount: 200000, occurred_on: "2026-11-02" }),
      tx({ id: "b", recurring_id: "w", type: "income", amount: 200000, occurred_on: "2026-11-16", status: "pending" }),
    ];
    const s = schedule([weekly], linked, FROM, TO, TODAY);
    expect(summary(s)).toEqual([
      ["w", "2026-11-02", "paid", false],
      ["w", "2026-11-09", "skipped", false],
      ["w", "2026-11-16", "pending", true],
      ["w", "2026-11-23", "upcoming", true],
      ["w", "2026-11-30", "upcoming", false],
    ]);
    expect(s.income).toEqual({ total: 800000, paid: 200000, left: 600000 });
  });

  it("lo vencido que aún no se genera sale vencido y es lo próximo a pagar", () => {
    const s = schedule([rule({ starts_on: "2026-10-15", next_on: "2026-11-15", description: "Arriendo" })], [], FROM, TO, TODAY);
    expect(summary(s)).toEqual([["r1", "2026-11-15", "overdue", true]]);
  });

  it("incluye los pendientes de antes del mes y omite los recurrentes en pausa", () => {
    const linked = [tx({ id: "old", recurring_id: "p", status: "pending", occurred_on: "2026-10-28", description: "Gimnasio" })];
    const s = schedule([rule({ id: "p", paused: true })], linked, FROM, TO, TODAY);
    expect(summary(s)).toEqual([["p", "2026-10-28", "pending", true]]);
  });

  it("dice el estado de cada fecha en palabras", () => {
    expect(scheduleLabel({ status: "paid", day: TODAY }, TODAY)).toBe("Pagado hoy");
    expect(scheduleLabel({ status: "paid", day: "2026-11-15" }, TODAY)).toBe("Pagado el 15 nov");
    expect(scheduleLabel({ status: "pending", day: "2026-11-15" }, TODAY)).toBe("Por confirmar");
    expect(scheduleLabel({ status: "overdue", day: "2026-11-15" }, TODAY)).toBe("Venció el 15 nov");
    expect(scheduleLabel({ status: "skipped", day: "2026-11-09" }, TODAY)).toBe("Omitido el 9 nov");
    expect(scheduleLabel({ status: "upcoming", day: TODAY }, TODAY)).toBe("Hoy");
    expect(scheduleLabel({ status: "upcoming", day: "2026-11-18" }, TODAY)).toBe("Mañana");
    expect(scheduleLabel({ status: "upcoming", day: "2026-11-20" }, TODAY)).toBe("20 nov");
  });

  it("no muestra un recurrente que empieza después del mes", () => {
    expect(schedule([rule({ starts_on: "2026-12-05", next_on: "2026-12-05" })], [], FROM, TO, TODAY).items).toEqual([]);
  });
});
