import { CheckCircleIcon, CircleIcon, RepeatIcon } from "phosphor-react-native";
import { ScrollView, View } from "react-native";
import { formatCOP } from "@/lib/money";
import { chargeKey, chargeName, dueLabel } from "@/lib/recurring-suggest";
import type { Category } from "@/lib/types";
import type { UpcomingCharge } from "@/lib/week-plan";
import { useTheme } from "@/theme/theme";
import { categoryColor } from "@/theme/tokens";
import { CategoryIcon } from "@/ui/category-icon";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

/**
 * Paso 1: los recurrentes que vencen ("Vence pronto"). Un toque llena el monto
 * y la categoría y lo deja listo para marcarlo pagado (src/app/add/recurring.tsx).
 */
export function DueChips({
  charges,
  categories,
  today,
  onPick,
}: {
  charges: UpcomingCharge[];
  categories: Category[];
  today: string;
  onPick: (charge: UpcomingCharge) => void;
}) {
  const { colors } = useTheme();
  if (charges.length === 0) return null;
  const byId = new Map(categories.map((c) => [c.id, c]));

  return (
    <View style={{ gap: 8 }}>
      <Text size={12} weight="medium" tone="muted" style={{ paddingHorizontal: 4, textTransform: "uppercase" }}>
        Vence pronto
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -16 }}>
        <View style={{ width: 8 }} />
        {charges.map((c) => {
          const category = c.categoryId ? byId.get(c.categoryId) : undefined;
          const name = chargeName(c, category);
          const when = dueLabel(c, today);
          return (
            <Tap
              key={chargeKey(c)}
              accessibilityRole="button"
              accessibilityLabel={`Marcar pagado ${name}, ${when}, ${formatCOP(c.amount)}`}
              pressScale={0.97}
              onPress={() => onPick(c)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                maxWidth: 260,
                minHeight: 52,
                paddingVertical: 8,
                paddingLeft: 12,
                paddingRight: 14,
                borderRadius: 14,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: c.pending ? colors.foreground : colors.border,
              }}
            >
              <CategoryIcon category={category} size={20} color={categoryColor(colors, category?.color)} />
              <View style={{ flexShrink: 1, minWidth: 0 }}>
                <Text size={14} weight="medium" numberOfLines={1}>
                  {name}
                </Text>
                <Text size={12} tone="muted" tabular numberOfLines={1}>
                  {when} · {formatCOP(c.amount)}
                </Text>
              </View>
            </Tap>
          );
        })}
        <View style={{ width: 8 }} />
      </ScrollView>
    </View>
  );
}

/** Paso 2: "Es el pago de Arriendo". Encendido, guardar lo marca pagado en vez de crear otro movimiento. */
export function PayToggle({
  charge,
  category,
  today,
  active,
  onToggle,
}: {
  charge: UpcomingCharge;
  category: Category | undefined;
  today: string;
  active: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  const name = chargeName(charge, category);
  const Check = active ? CheckCircleIcon : CircleIcon;
  return (
    <Tap
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={`Es el pago de ${name}`}
      pressScale={0.99}
      onPress={onToggle}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 56,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: active ? colors.foreground : colors.background,
        borderWidth: 1,
        borderColor: active ? colors.foreground : colors.border,
      }}
    >
      <RepeatIcon size={20} color={active ? colors.background : colors.muted} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={14} weight="medium" numberOfLines={1} style={{ color: active ? colors.background : colors.foreground }}>
          Es el pago de {name}
        </Text>
        <Text size={12} tabular numberOfLines={1} style={{ color: active ? colors.background : colors.muted, opacity: active ? 0.75 : 1 }}>
          {dueLabel(charge, today)} · {formatCOP(charge.amount)}
        </Text>
      </View>
      <Check size={24} weight={active ? "fill" : "regular"} color={active ? colors.background : colors.muted} />
    </Tap>
  );
}
