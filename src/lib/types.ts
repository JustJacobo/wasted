import type { TxType } from "@/lib/quick-add/parse";

export type { TxType };

export interface Category {
  id: string;
  key: string | null;
  name: string;
  emoji: string;
  /** Clave de src/lib/category-icons.ts; null en categorías propias antiguas. */
  icon: string | null;
  /** Clave de src/lib/category-colors.ts; null = gris neutro. */
  color: string | null;
  type: TxType;
  monthly_budget: number | null;
  sort: number;
  /** Archivada: no se ofrece para registrar, pero sigue nombrando movimientos pasados. */
  archived: boolean;
}

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  description: string;
  merchant: string | null;
  category_id: string | null;
  account_id: string | null;
  occurred_on: string;
  /** Instante del movimiento; null si no se sabe la hora. */
  occurred_at: string | null;
  source: string;
  status: "confirmed" | "pending" | "discarded";
  /** Recurrente del que salió o desde el que se creó; null si no tiene. */
  recurring_id: string | null;
  created_at: string;
}

/** Fuentes de los movimientos importados del correo. */
export const MAIL_SOURCES = ["email_bank", "email_invoice", "email_other"];

/** Lo que llega solo: del correo o de las notificaciones del teléfono (app de Android). */
export const IMPORTED_SOURCES = [...MAIL_SOURCES, "notification"];

/** Columnas de `transactions` que llenan un `Transaction`. */
export const TX_COLUMNS =
  "id, type, amount, description, merchant, category_id, account_id, occurred_on, occurred_at, source, status, recurring_id, created_at";

export interface Totals {
  income: number;
  expense: number;
}

/** La semana en curso más el saldo con que arrancó (lo que sobró o faltó antes del lunes). */
export interface WeekBudget extends Totals {
  carry: number;
}

export interface Summary {
  week: Totals;
  month: Totals;
  /** Ingresos menos gastos confirmados antes del lunes de esta semana. */
  carry: number;
}
