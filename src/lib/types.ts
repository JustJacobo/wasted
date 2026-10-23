import type { TxType } from "@/lib/quick-add/parse";

export type { TxType };

export interface Category {
  id: string;
  key: string | null;
  name: string;
  emoji: string;
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
  source: string;
  status: "confirmed" | "pending";
  created_at: string;
}

export interface Totals {
  income: number;
  expense: number;
}

export interface Summary {
  week: Totals;
  month: Totals;
}
