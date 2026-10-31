import { describe, expect, it } from "vitest";
import { csvCell, toCsv, transactionsCsv } from "./export-csv";
import type { Category, Transaction } from "./types";

const category = (id: string, name: string, archived = false): Category => ({
  id,
  key: null,
  name,
  emoji: "",
  icon: null,
  color: null,
  type: "expense",
  monthly_budget: null,
  sort: 0,
  archived,
});

const tx = (changes: Partial<Transaction>): Transaction => ({
  id: "t1",
  type: "expense",
  amount: 6000,
  description: "uber",
  merchant: null,
  category_id: "c1",
  account_id: null,
  occurred_on: "2026-10-26",
  occurred_at: null,
  source: "manual",
  status: "confirmed",
  recurring_id: null,
  created_at: "2026-10-26T12:00:00Z",
  ...changes,
});

const lines = (csv: string) => csv.replace(/^\uFEFF/, "").split("\r\n");

describe("celdas", () => {
  it("deja el texto simple tal cual y los números sin formato", () => {
    expect(csvCell("Almuerzo")).toBe("Almuerzo");
    expect(csvCell(-1250000)).toBe("-1250000");
    expect(csvCell(null)).toBe("");
  });

  it("entrecomilla separadores, comas, comillas y saltos de línea", () => {
    expect(csvCell("Rappi; pedido")).toBe('"Rappi; pedido"');
    expect(csvCell("Uber, viaje")).toBe('"Uber, viaje"');
    expect(csvCell('Tienda "La 14"')).toBe('"Tienda ""La 14"""');
    expect(csvCell("dos\nlíneas")).toBe('"dos\nlíneas"');
  });

  it("no deja que Excel ejecute fórmulas", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+57 300")).toBe("'+57 300");
    expect(csvCell("-algo")).toBe("'-algo");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });
});

describe("archivo", () => {
  it("empieza con BOM, separa con punto y coma y termina cada fila con CRLF", () => {
    const csv = toCsv([["a", 1], ["b", null]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toBe("\uFEFFa;1\r\nb;\r\n");
  });
});

describe("movimientos", () => {
  const categories = [category("c1", "Transporte"), category("c2", "Viejo", true)];

  it("trae encabezado y una fila por movimiento con el gasto en negativo", () => {
    const rows = lines(transactionsCsv([tx({}), tx({ type: "income", amount: 200000, description: "cuota semanal", category_id: null })], categories));
    expect(rows[0]).toBe("Fecha;Hora;Tipo;Categoría;Descripción;Comercio;Monto;Origen;Recurrente");
    expect(rows[1]).toBe("2026-10-26;;Gasto;Transporte;uber;;-6000;A mano;");
    expect(rows[2]).toBe("2026-10-26;;Ingreso;Sin categoría;cuota semanal;;200000;A mano;");
    expect(rows[3]).toBe("");
  });

  it("pone la hora de Colombia, el comercio, el origen y si es recurrente", () => {
    const [, row] = lines(
      transactionsCsv(
        [
          tx({
            occurred_at: "2026-10-27T02:41:00Z",
            merchant: "Google Play",
            description: "YouTube Premium",
            source: "email_other",
            recurring_id: "r1",
            category_id: "c2",
          }),
        ],
        categories,
      ),
    );
    expect(row).toBe("2026-10-26;21:41;Gasto;Viejo;YouTube Premium;Google Play;-6000;Correo;Sí");
  });

  it("nombra cada origen", () => {
    const origins = ["telegram", "shortcut", "recurring", "email_bank", "email_invoice"].map(
      (source) => lines(transactionsCsv([tx({ source })], categories))[1].split(";")[7],
    );
    expect(origins).toEqual(["Telegram", "Atajo", "Recurrente", "Correo", "Correo"]);
  });

  it("sin movimientos queda solo el encabezado", () => {
    expect(lines(transactionsCsv([], categories))).toEqual([
      "Fecha;Hora;Tipo;Categoría;Descripción;Comercio;Monto;Origen;Recurrente",
      "",
    ]);
  });
});
