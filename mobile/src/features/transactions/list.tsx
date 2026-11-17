import { router } from "expo-router";
import { memo } from "react";
import { View } from "react-native";
import { formatDay, formatTime } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import type { Category, Transaction } from "@/lib/types";
import { useTheme } from "@/theme/theme";
import { categoryColor } from "@/theme/tokens";
import { Divider } from "@/ui/card";
import { CategoryIcon } from "@/ui/category-icon";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

export interface DaySection {
  day: string;
  /** Lo gastado ese día. */
  spent: number;
  data: Transaction[];
}

/** Los movimientos por día, en el orden en que llegan (del más reciente al más antiguo). */
export function groupByDay(transactions: Transaction[]): DaySection[] {
  const days = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const day = days.get(tx.occurred_on);
    if (day) day.push(tx);
    else days.set(tx.occurred_on, [tx]);
  }
  return [...days].map(([day, data]) => ({
    day,
    data,
    spent: data.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0),
  }));
}

/** "HOY · -$22.000" sobre los movimientos de ese día. */
export function DayHeader({ day, spent, today }: { day: string; spent: number; today: string }) {
  return (
    <View style={{ paddingTop: 24, backgroundColor: "transparent" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: 4 }}>
        <Text size={12} weight="medium" tone="muted" style={{ textTransform: "uppercase" }}>
          {formatDay(day, today)}
        </Text>
        {spent > 0 && (
          <Text size={12} weight="medium" tone="muted" tabular>
            -{formatCOP(spent)}
          </Text>
        )}
      </View>
      <Divider />
    </View>
  );
}

/** Un movimiento: toca para editarlo. Memorizado para que la lista larga no se redibuje entera. */
export const TransactionRow = memo(function TransactionRow({ tx, category }: { tx: Transaction; category: Category | undefined }) {
  const { colors } = useTheme();
  const details = [
    tx.occurred_at && formatTime(tx.occurred_at),
    tx.description && (category?.name ?? "Sin categoría"),
    tx.source.startsWith("email_") && "del correo",
    tx.source === "notification" && "notificación",
    tx.recurring_id && "recurrente",
  ].filter(Boolean);
  const title = tx.description || category?.name || "Sin categoría";
  const amount = `${tx.type === "income" ? "+" : "-"}${formatCOP(Number(tx.amount))}`;
  return (
    <View>
      <Tap
        pressScale={0.99}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${amount}`}
        onPress={() => router.push({ pathname: "/movimientos/[id]", params: { id: tx.id } })}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 4 }}
      >
        <CategoryIcon category={category} color={categoryColor(colors, category?.color)} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1}>{title}</Text>
          {details.length > 0 && (
            <Text size={12} tone="muted" numberOfLines={1}>
              {details.join(" · ")}
            </Text>
          )}
        </View>
        <Text mono size={15} tracking={-0.3} tone={tx.type === "income" ? "accent" : "foreground"}>
          {amount}
        </Text>
      </Tap>
      <Divider />
    </View>
  );
});

export const EMPTY_HISTORY = "Todavía no hay movimientos. Toca ＋ para registrar el primero.";

/** Movimientos agrupados por día, con el gasto del día (src/app/transaction-list.tsx). Para listas cortas (el inicio). */
export function TransactionList({
  transactions,
  categories,
  today,
  empty,
}: {
  transactions: Transaction[];
  categories: Category[];
  today: string;
  empty?: string;
}) {
  if (transactions.length === 0) {
    return (
      <Text size={14} tone="muted" align="center" style={{ marginTop: 40 }}>
        {empty ?? EMPTY_HISTORY}
      </Text>
    );
  }
  const byId = new Map(categories.map((c) => [c.id, c]));
  return (
    <View>
      {groupByDay(transactions).map((section) => (
        <View key={section.day}>
          <DayHeader day={section.day} spent={section.spent} today={today} />
          {section.data.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} category={tx.category_id ? byId.get(tx.category_id) : undefined} />
          ))}
        </View>
      ))}
    </View>
  );
}
