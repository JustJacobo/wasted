import type { Transaction, WeekBudget } from "@/lib/types";

/** Un movimiento igual que ya llegó solo o ya está como recurrente (posible repetido). */
export interface Similar {
  label: string;
  from: "mail" | "notification" | "recurring";
}

/** Lo que responden quickAdd, addTransaction y payRecurring (src/app/actions.ts). */
export type QuickAddState =
  | { status: "ok"; transaction: Transaction; week: WeekBudget; similar: Similar | null; paid?: string; at: number }
  | { status: "moved"; message: string; at: number }
  | { status: "error"; error: string; at: number };
