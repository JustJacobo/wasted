import { describe, expect, it } from "vitest";
import { available, balance, budgetStatus } from "./budget";
import {
  goalMessage,
  loanMessage,
  outstanding,
  parseMoneyMove,
  sameName,
  summarizeGoals,
  summarizeLoans,
  type BalanceMove,
  type Goal,
  type Loan,
} from "./money-moves";

const NOW = new Date("2026-10-30T15:00:00Z"); // viernes 30 de octubre en Colombia
const $ = (n: string) => `$ ${n}`;
const parse = (text: string) => parseMoneyMove(text, NOW);

describe("entender préstamos y metas", () => {
  it("prestar", () => {
    expect(parse("le presté 20k a juan")).toEqual({ kind: "lend", person: "Juan", amount: 20000, occurredOn: "2026-10-30" });
    expect(parse("presté 20.000 a Juan Pérez")).toMatchObject({ kind: "lend", person: "Juan Pérez" });
    expect(parse("ayer le presté 15 lucas a mi mamá")).toMatchObject({ kind: "lend", person: "Mamá", amount: 15000, occurredOn: "2026-10-29" });
  });

  it("que te presten", () => {
    expect(parse("juan me prestó 50k")).toMatchObject({ kind: "borrow", person: "Juan", amount: 50000 });
    expect(parse("me prestó 50k mi papá")).toMatchObject({ kind: "borrow", person: "Papá" });
  });

  it("pagos de un lado y del otro", () => {
    expect(parse("juan me pagó 10k")).toMatchObject({ kind: "repaid", person: "Juan", amount: 10000 });
    expect(parse("me devolvió 10k juan")).toMatchObject({ kind: "repaid", person: "Juan" });
    expect(parse("le pagué 50k a juan")).toMatchObject({ kind: "repay", person: "Juan" });
    expect(parse("le devolví 50k a mi hermano")).toMatchObject({ kind: "repay", person: "Hermano" });
    // Sin "le" es un pago cualquiera: "pagué 80k luz" es la factura.
    expect(parse("pagué 80k luz")).toBeNull();
  });

  it("metas", () => {
    expect(parse("aparté 50k para el viaje")).toEqual({ kind: "save", goal: "Viaje", canCreate: true, amount: 50000, occurredOn: "2026-10-30" });
    // Sin "para" ni "en" solo cuenta si la meta ya existe ("guardé 15k parqueadero" es un gasto).
    expect(parse("guardé 15k parqueadero")).toMatchObject({ kind: "save", goal: "Parqueadero", canCreate: false });
    expect(parse("ahorré 20k para la meta portátil")).toMatchObject({ kind: "save", goal: "Portátil" });
    expect(parse("saqué 20k del viaje")).toMatchObject({ kind: "withdraw", goal: "Viaje" });
  });

  it("sin decir a quién se pregunta en vez de registrar un gasto", () => {
    expect(parse("le presté 20k")).toMatchObject({ kind: "lend", person: "" });
    expect(parse("me prestaron 50k")).toMatchObject({ kind: "borrow", person: "" });
  });

  it("lo demás es un gasto o un ingreso normal", () => {
    expect(parse("25k almuerzo")).toBeNull();
    expect(parse("+200k cuota semanal")).toBeNull();
    expect(parse("me pagaron 1.5M")).toBeNull();
    expect(parse("prestamo")).toBeNull();
  });
});

describe("cuentas", () => {
  const loan = (id: string, direction: Loan["direction"], person = "Juan"): Loan => ({ id, person, direction, created_at: "2026-10-01T00:00:00Z", closed_at: null });
  const move = (id: string, owner: { loan_id?: string; goal_id?: string }, amount: number, day = "2026-10-20"): BalanceMove => ({
    id,
    loan_id: owner.loan_id ?? null,
    goal_id: owner.goal_id ?? null,
    amount,
    occurred_on: day,
    created_at: `${day}T12:00:00Z`,
  });

  it("lo pendiente de cada lado", () => {
    expect(outstanding("lent", [{ amount: -20000 }, { amount: 5000 }])).toBe(15000);
    expect(outstanding("borrowed", [{ amount: 50000 }, { amount: -50000 }])).toBe(0);
  });

  it("totales: te deben y debes, con los abiertos primero", () => {
    const { items, owedToMe, iOwe } = summarizeLoans(
      [loan("a", "lent"), loan("b", "borrowed", "Ana"), loan("c", "lent", "Luis")],
      [move("1", { loan_id: "a" }, -20000), move("2", { loan_id: "a" }, 5000, "2026-10-25"), move("3", { loan_id: "b" }, 50000), move("4", { loan_id: "c" }, -10000), move("5", { loan_id: "c" }, 10000)],
    );
    expect(owedToMe).toBe(15000);
    expect(iOwe).toBe(50000);
    expect(items.map((i) => i.loan.id)).toEqual(["a", "b", "c"]);
    expect(items[0].moves[0].id).toBe("2");
  });

  it("metas con avance", () => {
    const goals: Goal[] = [
      { id: "g1", name: "Viaje", target: 200000, archived: false, created_at: "2026-10-01T00:00:00Z" },
      { id: "g2", name: "Colchón", target: null, archived: false, created_at: "2026-10-02T00:00:00Z" },
    ];
    const { items, total } = summarizeGoals(goals, [move("1", { goal_id: "g1" }, -50000), move("2", { goal_id: "g1" }, 10000), move("3", { goal_id: "g2" }, -30000)]);
    expect(items.find((g) => g.goal.id === "g1")).toMatchObject({ saved: 40000, progress: 0.2 });
    expect(items.find((g) => g.goal.id === "g2")).toMatchObject({ saved: 30000, progress: null });
    expect(total).toBe(70000);
  });

  it("prestar o apartar baja lo disponible sin contar como gasto", () => {
    const week = { income: 200000, expense: 40000, carry: 0, moved: -50000 };
    expect(available(week)).toBe(150000);
    expect(balance(week)).toBe(110000);
  });

  it("prestar todo y después gastar es pasarse, no quedarse sin presupuesto", () => {
    const week = { income: 100000, expense: 30000, carry: 0, moved: -100000 };
    expect(budgetStatus(week).level).toBe("over");
    expect(balance(week)).toBe(-30000);
    expect(budgetStatus({ income: 0, expense: 30000, carry: 0, moved: -10000 }).level).toBe("none");
  });

  it("reconoce a la misma persona", () => {
    expect(sameName("Juan", "juan")).toBe(true);
    expect(sameName("Juan Pérez", "juan perez")).toBe(true);
    expect(sameName("Juan", "Juan Pérez")).toBe(true);
    expect(sameName("Ana", "Juan")).toBe(false);
  });
});

describe("mensajes", () => {
  it("dice cuánto queda pendiente", () => {
    expect(loanMessage("lend", "Juan", 20000, 20000)).toBe(`🤝 Le prestaste ${$("20.000")} a Juan. Te debe ${$("20.000")}`);
    expect(loanMessage("repaid", "Juan", 5000, 15000)).toBe(`✓ Juan te pagó ${$("5.000")}. Todavía te debe ${$("15.000")}`);
    expect(loanMessage("repay", "Ana", 50000, 0)).toBe(`✓ Le pagaste ${$("50.000")} a Ana. Ya no le debes nada`);
    expect(goalMessage("save", { name: "Viaje", target: 200000 }, 50000, 50000, true)).toBe(
      `🎯 Apartaste ${$("50.000")} para Viaje (meta nueva). Llevas ${$("50.000")} de ${$("200.000")}`,
    );
  });
});
