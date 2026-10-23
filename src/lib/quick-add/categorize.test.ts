import { describe, expect, it } from "vitest";
import { fallbackCategory, matchCategory, ruleKeyword, type CategoryOption } from "./categorize";

const categories: CategoryOption[] = [
  { id: "c-comida", key: "comida", name: "Comida", type: "expense" },
  { id: "c-tienda", key: "tienda", name: "Tienda", type: "expense" },
  { id: "c-compras", key: "compras", name: "Compras", type: "expense" },
  { id: "c-transporte", key: "transporte", name: "Transporte", type: "expense" },
  { id: "c-salud", key: "salud", name: "Salud", type: "expense" },
  { id: "c-mascotas", key: null, name: "Mascotas", type: "expense" },
  { id: "c-varios", key: "otros_gasto", name: "Varios", type: "expense" },
  { id: "c-cuota", key: "cuota_semanal", name: "Cuota semanal", type: "income" },
  { id: "c-regalos", key: "regalos", name: "Regalos", type: "income" },
  { id: "c-otros-in", key: "otros_ingreso", name: "Otros", type: "income" },
];

describe("matchCategory", () => {
  it("usa las palabras clave integradas", () => {
    expect(matchCategory("Almuerzo", "expense", categories, [])).toBe("c-comida");
    expect(matchCategory("Uber al trabajo", "expense", categories, [])).toBe("c-transporte");
    expect(matchCategory("Café", "expense", categories, [])).toBe("c-comida");
  });

  it.each([
    ["Diddi", "c-transporte"],
    ["Yango", "c-transporte"],
    ["Mecato", "c-comida"],
    ["Coca-cola", "c-comida"],
    ["Leche", "c-tienda"],
    ["Cosas tienda", "c-tienda"],
    ["Pasedol", "c-salud"],
  ])("reconoce los gastos que se registraban en Notion: %s", (description, id) => {
    expect(matchCategory(description, "expense", categories, [])).toBe(id);
  });

  it("reconoce ingresos de cuota semanal y regalos", () => {
    expect(matchCategory("Cuota semanal", "income", categories, [])).toBe("c-cuota");
    expect(matchCategory("Regalo papá", "income", categories, [])).toBe("c-regalos");
  });

  it("prefiere la frase más larga", () => {
    expect(matchCategory("Pedido Mercado Libre", "expense", categories, [])).toBe("c-compras");
    expect(matchCategory("Mercado del mes", "expense", categories, [])).toBe("c-tienda");
  });

  it("las reglas del usuario ganan sobre las integradas", () => {
    const rules = [{ keyword: "comida perro", category_id: "c-mascotas" }];
    expect(matchCategory("Comida perro", "expense", categories, rules)).toBe("c-mascotas");
  });

  it("solo considera categorías del mismo tipo", () => {
    expect(matchCategory("Almuerzo", "income", categories, [])).toBeNull();
  });

  it("no hace coincidencias parciales de palabras", () => {
    expect(matchCategory("Panela", "expense", categories, [])).toBeNull();
  });

  it("devuelve null sin descripción", () => {
    expect(matchCategory("", "expense", categories, [])).toBeNull();
  });
});

describe("ruleKeyword", () => {
  it("pliega tildes, mayúsculas y puntuación", () => {
    expect(ruleKeyword("  Café, Juan Valdez! ")).toBe("cafe juan valdez");
  });
});

describe("fallbackCategory", () => {
  it("usa la categoría de respaldo del tipo correspondiente", () => {
    expect(fallbackCategory("expense", categories)).toBe("c-varios");
    expect(fallbackCategory("income", categories)).toBe("c-otros-in");
  });
});
