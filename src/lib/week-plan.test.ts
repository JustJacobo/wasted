import { describe, expect, it } from "vitest";
import type { Recurring } from "./recurring";
import { upcomingCharges, weekPlan, weekPlanMessage, type LinkedCharge, type UpcomingCharge } from "./week-plan";

// Intl separa "$" del número con un espacio duro.
const $ = (n: string) => `$ ${n}`;

// Semana del lunes 26 de octubre al domingo 1 de noviembre de 2026.
const MON = "2026-10-26";
const WED = "2026-10-28";
const SUN = "2026-11-01";

const rule = (changes: Partial<Recurring>): Recurring => ({
  id: "r1",
  type: "expense",
  amount: 26900,
  description: "Netflix",
  category_id: "c1",
  every: 1,
  unit: "month",
  starts_on: "2026-08-30",
  next_on: "2026-10-30",
  paused: false,
  match_hint: null,
  ...changes,
});

const charge = (changes: Partial<UpcomingCharge>): UpcomingCharge => ({
  day: "2026-10-30",
  type: "expense",
  amount: 0,
  description: "",
  categoryId: null,
  ruleId: "r1",
  pending: false,
  ...changes,
});

const week = (income: number, expense: number, carry = 0) => ({ income, expense, carry });

describe("próximos cobros", () => {
  it("trae la próxima fecha de cada regla activa dentro de la ventana", () => {
    const items = upcomingCharges(
      [rule({}), rule({ id: "r2", next_on: "2026-11-20" }), rule({ id: "r3", paused: true })],
      [],
      WED,
      "2026-11-04",
    );
    expect(items.map((i) => [i.ruleId, i.day])).toEqual([["r1", "2026-10-30"]]);
  });

  it("repite las reglas cortas y lo vencido sin generar cuenta desde hoy", () => {
    const daily = rule({ id: "d", every: 2, unit: "day", starts_on: "2026-10-20", next_on: "2026-10-26" });
    const days = upcomingCharges([daily], [], WED, "2026-11-01").map((i) => i.day);
    expect(days).toEqual([WED, WED, "2026-10-30", SUN]);
  });

  it("suma los pendientes de la bandeja y no repite la fecha que ya llegó por correo", () => {
    const linked: LinkedCharge[] = [
      { id: "t1", recurring_id: "r1", status: "pending", type: "expense", amount: 26900, description: "Netflix", category_id: "c1", occurred_on: "2026-10-29" },
      { id: "t2", recurring_id: "r9", status: "confirmed", type: "expense", amount: 5000, description: "Otro", category_id: null, occurred_on: WED },
    ];
    const items = upcomingCharges([rule({})], linked, WED, "2026-11-04");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ day: "2026-10-29", pending: true, amount: 26900 });
  });

  it("un correo ya confirmado y unido también evita contar la fecha", () => {
    const linked: LinkedCharge[] = [
      { id: "t1", recurring_id: "r1", status: "confirmed", type: "expense", amount: 26900, description: "Netflix", category_id: "c1", occurred_on: WED },
    ];
    expect(upcomingCharges([rule({})], linked, WED, "2026-11-04")).toEqual([]);
  });
});

describe("plan de la semana", () => {
  it("reparte lo que queda en los días hasta el domingo, sin lo comprometido", () => {
    // Miércoles: quedan 5 días. 200k − 40k = 160k; menos Netflix 26.900 = 133.100 → 26.600/día.
    const plan = weekPlan(week(200000, 40000), WED, [charge({ amount: 26900 })]);
    expect(plan).toMatchObject({ left: 160000, committed: 26900, free: 133100, daysLeft: 5, perDay: 26600, runsOutOn: null });
    expect(weekPlanMessage(plan, WED)).toBe(`Puedes gastar ${$("26.600")} por día hasta el domingo`);
  });

  it("los ingresos recurrentes de la semana suman y lo de la semana siguiente no cuenta", () => {
    const plan = weekPlan(week(0, 0, 100000), WED, [
      charge({ type: "income", amount: 50000 }),
      charge({ day: "2026-11-02", amount: 999999 }),
    ]);
    expect(plan.committed).toBe(-50000);
    expect(plan.free).toBe(150000);
  });

  it("el domingo habla de hoy", () => {
    const plan = weekPlan(week(200000, 150000), SUN, []);
    expect(plan.daysLeft).toBe(1);
    expect(weekPlanMessage(plan, SUN)).toBe(`Hoy puedes gastar ${$("50.000")}`);
  });

  it("avisa el día en que se acaba al ritmo de la semana", () => {
    // Miércoles, 3 días gastando 60k/día; quedan 20k → alcanza para hoy.
    const today = weekPlan(week(200000, 180000), WED, []);
    expect(weekPlanMessage(today, WED)).toBe("A este ritmo te alcanza solo para hoy");
    // 3 días a 30k/día; quedan 110k → alcanza 3 días más: hasta el sábado.
    const saturday = weekPlan(week(200000, 90000), WED, []);
    expect(saturday.runsOutOn).toBe("2026-10-31");
    expect(weekPlanMessage(saturday, WED)).toBe("A este ritmo te alcanza hasta el sábado");
  });

  it("el lunes no juzga el ritmo", () => {
    const plan = weekPlan(week(200000, 150000), MON, []);
    expect(plan.runsOutOn).toBeNull();
    expect(weekPlanMessage(plan, MON)).toBe(`Puedes gastar ${$("7.100")} por día hasta el domingo`);
  });

  it("si los cobros se llevan lo que queda, lo dice", () => {
    const plan = weekPlan(week(50000, 30000), WED, [charge({ amount: 26900 })]);
    expect(plan.free).toBeLessThan(0);
    expect(weekPlanMessage(plan, WED)).toBe("Lo que queda ya está comprometido en cobros de esta semana");
  });

  it("calla sin presupuesto o sin saldo", () => {
    expect(weekPlanMessage(weekPlan(week(0, 20000), WED, []), WED)).toBeNull();
    expect(weekPlanMessage(weekPlan(week(100000, 120000), WED, []), WED)).toBeNull();
  });
});
