// Movimientos a CSV para Excel y Google Sheets. Puro: recibe los movimientos y
// las categorías y devuelve el texto del archivo.

import { timeInputValue } from "@/lib/dates";
import { MAIL_SOURCES, type Category, type Transaction } from "@/lib/types";

/**
 * Excel en español separa las columnas con punto y coma (la coma es el
 * decimal). Google Sheets lo detecta solo al importar.
 */
const SEPARATOR = ";";

/** Sin la marca BOM, Excel lee el archivo como Latin-1 y daña las tildes. */
const BOM = "﻿";

const HEADER = ["Fecha", "Hora", "Tipo", "Categoría", "Descripción", "Comercio", "Monto", "Origen", "Recurrente"];

const SOURCES: Record<string, string> = {
  manual: "A mano",
  telegram: "Telegram",
  shortcut: "Atajo",
  recurring: "Recurrente",
  receipt_photo: "Foto",
};

type Cell = string | number | null;

/**
 * Un texto que empieza por = + - @ Excel lo ejecuta como fórmula. Los comercios
 * vienen de correos ajenos, así que se neutralizan con un apóstrofo.
 */
function text(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function csvCell(value: Cell): string {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  const safe = text(value);
  return /[;",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: Cell[][]): string {
  return BOM + rows.map((row) => row.map(csvCell).join(SEPARATOR)).join("\r\n") + "\r\n";
}

function origin(source: string): string {
  if (MAIL_SOURCES.includes(source)) return "Correo";
  return SOURCES[source] ?? source;
}

/**
 * Una fila por movimiento, en el orden recibido. El monto lleva signo (los
 * gastos en negativo) para que una suma dé el saldo.
 */
export function transactionsCsv(transactions: Transaction[], categories: Category[]): string {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return toCsv([
    HEADER,
    ...transactions.map((tx) => [
      tx.occurred_on,
      tx.occurred_at ? timeInputValue(tx.occurred_at) : null,
      tx.type === "income" ? "Ingreso" : "Gasto",
      (tx.category_id && byId.get(tx.category_id)?.name) || "Sin categoría",
      tx.description || null,
      tx.merchant,
      tx.type === "income" ? Number(tx.amount) : -Number(tx.amount),
      origin(tx.source),
      tx.recurring_id ? "Sí" : null,
    ]),
  ]);
}
