import { describe, expect, it } from "vitest";
import { buildReport } from "@/lib/report";
import {
  budgetAlertText,
  categoryKeyboard,
  crossedBudget,
  decodeId,
  encodeId,
  escapeHtml,
  parseCallback,
  pendingKeyboard,
  recurringDueText,
  reportText,
  savedKeyboard,
  savedText,
  todayText,
} from "./format";

const TX = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";
const CAT = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

describe("ids en callback_data", () => {
  it("codifica y decodifica un uuid", () => {
    expect(encodeId(TX)).toHaveLength(22);
    expect(decodeId(encodeId(TX))).toBe(TX);
  });

  it("rechaza basura", () => {
    expect(decodeId("abc")).toBeNull();
    expect(parseCallback("x:123")).toBeNull();
    expect(parseCallback("s:" + encodeId(TX))).toBeNull();
  });

  it("los botones caben en 64 bytes y se pueden leer de vuelta", () => {
    const rows = categoryKeyboard(TX, [{ id: CAT, emoji: "🍔", name: "Comida" }], null);
    const data = rows[0][0].callback_data;
    expect(new TextEncoder().encode(data).length).toBeLessThanOrEqual(64);
    expect(parseCallback(data)).toEqual({ action: "set", txId: TX, categoryId: CAT });
    expect(parseCallback(savedKeyboard(TX)[0][1].callback_data)).toEqual({ action: "undo", txId: TX });
  });

  it("los botones de un pendiente lo agregan o lo omiten", () => {
    const [[add, skip]] = pendingKeyboard(TX);
    expect(parseCallback(add.callback_data)).toEqual({ action: "confirm", txId: TX });
    expect(parseCallback(skip.callback_data)).toEqual({ action: "skip", txId: TX });
    expect(new TextEncoder().encode(add.callback_data).length).toBeLessThanOrEqual(64);
  });

  it("organiza las categorías de a dos y marca la actual", () => {
    const cats = ["a", "b", "c"].map((n, i) => ({ id: i === 1 ? CAT : TX, emoji: "•", name: n }));
    const rows = categoryKeyboard(TX, cats, CAT);
    expect(rows.map((r) => r.length)).toEqual([2, 1, 1]);
    expect(rows[0][1].text).toBe("✓ • b");
    expect(rows.at(-1)![0].text).toBe("← Volver");
  });
});

describe("mensajes", () => {
  it("escapa el HTML del usuario", () => {
    expect(escapeHtml("<b>a & b</b>")).toBe("&lt;b&gt;a &amp; b&lt;/b&gt;");
    const text = savedText(
      { type: "expense", amount: 25000, description: "<script>", occurred_on: "2026-10-23" },
      { emoji: "🍔", name: "Comida" },
      "2026-10-23",
    );
    expect(text).toContain("&lt;script&gt;");
    expect(text).not.toContain("<script>");
  });

  it("confirma el registro con categoría y día", () => {
    const text = savedText(
      { type: "expense", amount: 25000, description: "Almuerzo", occurred_on: "2026-10-22" },
      { emoji: "🍔", name: "Comida" },
      "2026-10-23",
    );
    expect(text).toContain("✓ Gasto <b>$ 25.000</b> · Almuerzo");
    expect(text).toContain("🍔 Comida · Ayer");
  });

  it("agrega el aviso de presupuesto solo a gastos en 80% o más", () => {
    const tx = { type: "expense" as const, amount: 1000, description: "", occurred_on: "2026-10-23" };
    expect(savedText(tx, undefined, "2026-10-23", { income: 100_000, expense: 50_000, carry: 0 })).not.toContain("⚠️");
    expect(savedText(tx, undefined, "2026-10-23", { income: 100_000, expense: 85_000, carry: 0 })).toContain(
      "⚠️ Cuidado: llevas 85% de lo disponible esta semana",
    );
    expect(
      savedText({ ...tx, type: "income" }, undefined, "2026-10-23", { income: 100_000, expense: 85_000, carry: 0 }),
    ).not.toContain("⚠️");
  });

  it("/hoy suma y lista lo de hoy", () => {
    expect(todayText([], [])).toContain("no has registrado");
    const text = todayText(
      [
        { type: "expense", amount: 25000, description: "Almuerzo", category_id: CAT },
        { type: "income", amount: 100000, description: "", category_id: null },
      ],
      [{ id: CAT, emoji: "🍔", name: "Comida" }],
    );
    expect(text).toContain("gastaste <b>$ 25.000</b>");
    expect(text).toContain("Entró $ 100.000");
    expect(text).toContain("🍔 Almuerzo · -$ 25.000");
  });

  it("resume la semana con variación, te quedan y categorías", () => {
    const report = buildReport(
      "semana",
      "2026-10-21",
      "2026-10-23",
      [
        { type: "income", amount: 200_000, category_id: null, occurred_on: "2026-10-19" },
        { type: "expense", amount: 170_000, category_id: CAT, occurred_on: "2026-10-20" },
        { type: "expense", amount: 100_000, category_id: CAT, occurred_on: "2026-10-13" },
      ],
      [{ id: CAT, name: "Comida", emoji: "🍔" }],
    );
    const text = reportText("semana", report, { title: "Esta semana", carry: 0 });
    expect(text).toContain("<b>Esta semana · 19 – 25 oct</b>");
    expect(text).toContain("Te quedan <b>$ 30.000</b>");
    expect(text).toContain("▲ 70% vs la semana anterior");
    expect(text).toContain("⚠️ Cuidado: llevas 85% de lo disponible");
    expect(text).toContain("🍔 Comida · $ 170.000 (100%)");
    expect(text).not.toContain("Saldo anterior");

    const withCarry = reportText("semana", report, { title: "Esta semana", carry: 50_000 });
    expect(withCarry).toContain("Te quedan <b>$ 80.000</b>");
    expect(withCarry).toContain("Saldo anterior $ 50.000");
    expect(withCarry).not.toContain("⚠️");
    expect(reportText("semana", report)).not.toContain("Te quedan");

    const plan = "Puedes gastar $ 26.600 por día hasta el domingo";
    expect(reportText("semana", report, { title: "Esta semana", carry: 50_000, plan })).toContain(plan);
    // La proyección es de la semana en curso: el reporte programado (sin saldo) no la lleva.
    expect(reportText("semana", report, { plan })).not.toContain(plan);
  });
});

describe("avisos de presupuesto", () => {
  it("avisa solo al cruzar un umbral", () => {
    const w = (expense: number, income: number, carry = 0) => ({ expense, income, carry });
    expect(crossedBudget(w(70, 100), w(85, 100))).toBe(true);
    expect(crossedBudget(w(85, 100), w(90, 100))).toBe(false);
    expect(crossedBudget(w(90, 100), w(110, 100))).toBe(true);
    expect(crossedBudget(w(10, 0), w(20, 0))).toBe(false);
    expect(crossedBudget(w(10, 0, 100), w(85, 0, 100))).toBe(true);
  });

  it("dice cuánto queda o cuánto se pasó", () => {
    expect(budgetAlertText({ income: 100_000, expense: 85_000, carry: 0 })).toContain("Te quedan $ 15.000");
    expect(budgetAlertText({ income: 100_000, expense: 120_000, carry: 0 })).toContain("Te pasaste $ 20.000");
    expect(budgetAlertText({ income: 100_000, expense: 10_000, carry: 0 })).toBeNull();
    expect(budgetAlertText({ income: 100_000, expense: 130_000, carry: 50_000 })).toContain("Te quedan $ 20.000");
    expect(budgetAlertText({ income: 100_000, expense: 120_000, carry: 10_000 })).toBe(
      "🔴 Te pasaste $ 10.000 de lo disponible esta semana.\nSalió $ 120.000 y entró $ 100.000; saldo anterior $ 10.000.",
    );
  });
});

describe("recurrentes", () => {
  it("avisa lo que venció, escapado", () => {
    const text = recurringDueText(
      { type: "expense", amount: 800000, description: "Arriendo <apto>", occurred_on: "2026-11-01" },
      { emoji: "🏠", name: "Vivienda" },
      "2026-11-01",
    );
    expect(text).toBe("🔁 Por confirmar: Arriendo &lt;apto&gt; <b>$ 800.000</b>\n🏠 Vivienda · Hoy");
  });

  it("marca los ingresos con +", () => {
    const text = recurringDueText(
      { type: "income", amount: 200000, description: "", occurred_on: "2026-11-02" },
      undefined,
      "2026-11-02",
    );
    expect(text).toBe("🔁 Por confirmar: <b>+$ 200.000</b>\nSin categoría · Hoy");
  });
});
