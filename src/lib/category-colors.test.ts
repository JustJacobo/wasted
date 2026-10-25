import { describe, expect, it } from "vitest";
import { categoryColorVar, nextCategoryColor } from "./category-colors";

describe("colores de categoría", () => {
  it("elige el primero que falta en el orden de la paleta", () => {
    expect(nextCategoryColor([])).toBe("azul");
    expect(nextCategoryColor(["azul", "naranja", null])).toBe("aqua");
    expect(nextCategoryColor(["naranja"])).toBe("azul");
  });

  it("con todos usados, repite el menos usado", () => {
    const all = ["azul", "naranja", "aqua", "amarillo", "magenta", "verde", "violeta", "rojo"];
    expect(nextCategoryColor(all)).toBe("azul");
    expect(nextCategoryColor([...all, "azul", "naranja"])).toBe("aqua");
  });

  it("sin color o con uno desconocido, gris", () => {
    expect(categoryColorVar("verde")).toBe("var(--cat-verde)");
    expect(categoryColorVar(null)).toBe("var(--cat-gris)");
    expect(categoryColorVar("fucsia")).toBe("var(--cat-gris)");
  });
});
