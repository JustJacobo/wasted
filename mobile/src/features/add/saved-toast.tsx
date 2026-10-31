import { ScrollView, View } from "react-native";
import Animated, { FadeInDown, FadeOut, ReduceMotion } from "react-native-reanimated";
import { budgetMessage, budgetStatus } from "@/lib/budget";
import { formatCOP } from "@/lib/money";
import type { Category } from "@/lib/types";
import { api } from "@/core/api";
import { refreshAfterWrite } from "@/core/query";
import { useTheme } from "@/theme/theme";
import { categoryColor } from "@/theme/tokens";
import { CategoryIcon } from "@/ui/category-icon";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";
import { keepFeedback, showFeedback, type Feedback } from "./feedback";

/** Confirmación tras guardar: deshacer o cambiar la categoría (src/app/add/saved-toast.tsx). */
export function SavedToast({ feedback, categories }: { feedback: Feedback; categories: Category[] }) {
  const { colors } = useTheme();
  const refresh = refreshAfterWrite;
  const container = {
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
  } as const;
  const motion = { entering: FadeInDown.duration(200).reduceMotion(ReduceMotion.System), exiting: FadeOut.duration(150) };

  if (feedback.kind === "moved") {
    return (
      <Animated.View {...motion} style={container}>
        <Text size={14} accessibilityLiveRegion="polite">
          {feedback.message}
        </Text>
      </Animated.View>
    );
  }

  const { transaction, week, similar } = feedback;
  const options = categories.filter((c) => c.type === transaction.type && !c.archived);
  const status = budgetStatus(week);
  const warning = transaction.type === "expense" && (status.level === "warning" || status.level === "over") ? budgetMessage(status, week) : null;

  function undo() {
    showFeedback(null);
    api("deleteTransaction", { id: transaction.id }).finally(refresh);
  }

  function changeCategory(categoryId: string) {
    keepFeedback({ ...feedback, transaction: { ...transaction, category_id: categoryId } } as Feedback);
    api("setCategory", { id: transaction.id, categoryId }).finally(refresh);
  }

  return (
    <Animated.View {...motion} style={container}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text size={14} tabular numberOfLines={1} accessibilityLiveRegion="polite" style={{ flex: 1 }}>
          <Text size={14} tone="accent">
            ✓
          </Text>{" "}
          {transaction.type === "income" ? "Ingreso" : "Gasto"} <Text size={14} weight="semibold">{formatCOP(Number(transaction.amount))}</Text>
          {transaction.description ? ` · ${transaction.description}` : ""}
        </Text>
        <Tap accessibilityRole="button" onPress={undo} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}>
          <Text size={14} weight="medium" tone="danger">
            Deshacer
          </Text>
        </Tap>
      </View>
      {similar && (
        <Text size={12}>
          {similar.from === "recurring" ? "🔁" : similar.from === "notification" ? "🔔" : "📧"} Parece repetido:{" "}
          {similar.from === "recurring" ? "ya está como recurrente" : similar.from === "notification" ? "ya llegó por una notificación" : "ya llegó del correo"} ({similar.label}).
        </Text>
      )}
      {warning && <Text size={12}>⚠️ {warning}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {options.map((c) => {
          const active = c.id === transaction.category_id;
          return (
            <Tap
              key={c.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => changeCategory(c.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                height: 36,
                paddingHorizontal: 12,
                borderRadius: 18,
                backgroundColor: active ? colors.foreground : colors.background,
                borderWidth: active ? 0 : 1,
                borderColor: colors.border,
              }}
            >
              <CategoryIcon category={c} size={16} color={active ? colors.background : categoryColor(colors, c.color)} />
              <Text size={14} style={{ color: active ? colors.background : colors.foreground }}>
                {c.name}
              </Text>
            </Tap>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}
