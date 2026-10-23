import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./parse";

// Viernes 23 de octubre de 2026, mediodía en Bogotá.
const NOW = new Date("2026-10-23T17:00:00Z");
const parse = (text: string) => parseQuickAdd(text, NOW);

describe("montos", () => {
  it.each([
    ["25k almuerzo", 25_000],
    ["25K almuerzo", 25_000],
    ["almuerzo 25.000", 25_000],
    ["$25.000 almuerzo", 25_000],
    ["$ 25.000 almuerzo", 25_000],
    ["25 mil almuerzo", 25_000],
    ["25000 almuerzo", 25_000],
    ["20 lucas uber", 20_000],
    ["2.5k parqueadero", 2_500],
    ["1.5M arriendo", 1_500_000],
    ["1,5 millones arriendo", 1_500_000],
    ["2.500.000 arriendo", 2_500_000],
    ["1 palo préstamo", 1_000_000],
  ])("%s → %d", (text, amount) => {
    expect(parse(text)?.amount).toBe(amount);
  });

  it("interpreta números menores a 100 sin sufijo como miles", () => {
    expect(parse("25 almuerzo")?.amount).toBe(25_000);
  });

  it("deja tal cual montos de 100 en adelante sin sufijo", () => {
    expect(parse("500 bolsa")?.amount).toBe(500);
  });

  it("devuelve null si no hay monto", () => {
    expect(parse("almuerzo")).toBeNull();
    expect(parse("")).toBeNull();
    expect(parse("0 nada")).toBeNull();
  });

  it("no confunde una palabra que empieza por m con el sufijo de millones", () => {
    expect(parse("25 mercado")).toMatchObject({ amount: 25_000, description: "Mercado" });
  });
});

describe("gasto o ingreso", () => {
  it("es gasto por defecto", () => {
    expect(parse("25k almuerzo")?.type).toBe("expense");
  });

  it("es ingreso con +", () => {
    expect(parse("+3.5M salario")).toMatchObject({
      type: "income",
      amount: 3_500_000,
      description: "Salario",
    });
  });

  it.each([
    "salario 3500000",
    "me pagaron 200k freelance",
    "quincena 1.2M",
    "reembolso 40k",
    "cuota semanal 200k",
    "me regalaron 30k mi papá",
  ])(
    "detecta ingreso por palabra clave: %s",
    (text) => {
      expect(parse(text)?.type).toBe("income");
    },
  );

  it("el - fuerza gasto aunque haya palabra de ingreso", () => {
    expect(parse("-40k devolución tienda")?.type).toBe("expense");
  });
});

describe("fechas", () => {
  it("usa hoy por defecto", () => {
    expect(parse("25k almuerzo")?.occurredOn).toBe("2026-10-23");
  });

  it.each([
    ["ayer 30k taxi", "2026-10-22", "Taxi"],
    ["taxi 30k antier", "2026-10-21", "Taxi"],
    ["antes de ayer 30k taxi", "2026-10-21", "Taxi"],
    ["el lunes 12k café", "2026-10-19", "Café"],
    ["viernes 10k pan", "2026-10-23", "Pan"],
    ["15/10 40k mercado", "2026-10-15", "Mercado"],
    ["40k mercado 3/9/2026", "2026-09-03", "Mercado"],
  ])("%s → %s", (text, day, description) => {
    expect(parse(text)).toMatchObject({ occurredOn: day, description });
  });

  it("una fecha sin año en el futuro se refiere al año pasado", () => {
    expect(parse("28/12 40k regalos")?.occurredOn).toBe("2025-12-28");
  });

  it("la fecha no se interpreta como monto", () => {
    expect(parse("15/10 mercado")).toBeNull();
  });
});

describe("descripción", () => {
  it("quita conectores sueltos", () => {
    expect(parse("25k en el corrientazo")?.description).toBe("Corrientazo");
    expect(parse("almuerzo de 25k")?.description).toBe("Almuerzo");
  });

  it("conserva tildes y mayúsculas del texto original", () => {
    expect(parse("Mercado Éxito 85.400")?.description).toBe("Mercado Éxito");
  });

  it("puede quedar vacía", () => {
    expect(parse("25k")?.description).toBe("");
  });
});
