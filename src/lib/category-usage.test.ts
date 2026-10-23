import { describe, expect, it } from "vitest";
import { sortByUsage } from "./category-usage";

const categories = [
  { id: "comida", sort: 1 },
  { id: "transporte", sort: 2 },
  { id: "tienda", sort: 3 },
  { id: "varios", sort: 99 },
];

const ids = (list: { id: string }[]) => list.map((c) => c.id);

describe("sortByUsage", () => {
  it("sin movimientos respeta el orden configurado", () => {
    expect(ids(sortByUsage(categories, []))).toEqual(["comida", "transporte", "tienda", "varios"]);
  });

  it("pone primero las más usadas", () => {
    const txs = [
      { category_id: "transporte" },
      { category_id: "transporte" },
      { category_id: "tienda" },
      { category_id: null },
    ];
    expect(ids(sortByUsage(categories, txs))).toEqual(["transporte", "tienda", "comida", "varios"]);
  });

  it("no modifica el arreglo original", () => {
    sortByUsage(categories, [{ category_id: "varios" }]);
    expect(categories[0].id).toBe("comida");
  });
});
