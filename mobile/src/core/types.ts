// Lo que responden las operaciones de /api/app (src/app/api/app/ops.ts).

import type { CategoryRule } from "@/lib/quick-add/categorize";
import type { Category, Summary, Transaction } from "@/lib/types";
import type { UpcomingCharge } from "@/lib/week-plan";

export interface Me {
  userId: string;
  email: string;
  name: string;
  role: "owner" | "member";
}

export interface HomeData {
  today: string;
  name: string;
  summary: Summary;
  categories: Category[];
  rules: CategoryRule[];
  transactions: Transaction[];
  pendingCount: number;
  upcoming: UpcomingCharge[];
  money: { owedToMe: number; iOwe: number; saved: number };
  /** Transferencias a personas que esperan categoría (src/lib/classify.ts). */
  toClassify: ToClassifyItem[];
  appearance: { accent: string | null; mode: string | null };
}

export interface ToClassifyItem {
  id: string;
  amount: number;
  merchant: string;
  occurred_on: string;
  occurred_at: string | null;
}
