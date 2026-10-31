import { router } from "expo-router";
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

/** Movimientos agrupados por día, con el gasto del día (src/app/transaction-list.tsx). */
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
  const { colors } = useTheme();
  if (transactions.length === 0) {
    return (
      <Text size={14} tone="muted" align="center" style={{ marginTop: 40 }}>
        {empty ?? "Todavía no hay movimientos. Toca − Gasto o + Ingreso para registrar el primero."}
      </Text>
    );
  }

  const byId = new Map(categories.map((c) => [c.id, c]));
  const days = new Map<string, Transaction[]>();
  for (const tx of transactions) days.set(tx.occurred_on, [...(days.get(tx.occurred_on) ?? []), tx]);

  return (
    <View style={{ marginTop: 24, gap: 24 }}>
      {[...days].map(([day, items]) => {
        const spent = items.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
        return (
          <View key={day}>
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
            {items.map((tx) => {
              const category = tx.category_id ? byId.get(tx.category_id) : undefined;
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
                <View key={tx.id}>
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
            })}
          </View>
        );
      })}
    </View>
  );
}
