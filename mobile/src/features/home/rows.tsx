import { Handshake, PiggyBank, Tray } from "phosphor-react-native";
import { View } from "react-native";
import { addDays, formatDay } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import type { Category } from "@/lib/types";
import type { UpcomingCharge } from "@/lib/week-plan";
import { useTheme } from "@/theme/theme";
import { categoryColor } from "@/theme/tokens";
import { Divider } from "@/ui/card";
import { CategoryIcon } from "@/ui/category-icon";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

function Row({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Tap
      pressScale={0.99}
      accessibilityRole={onPress ? "button" : "text"}
      disabled={!onPress}
      onPress={onPress}
      style={{
        marginTop: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minHeight: 48,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: 1,
      }}
    >
      {icon}
      <Text size={14} tabular numberOfLines={1} style={{ flex: 1 }}>
        {label}
      </Text>
      {onPress && <Text tone="muted">›</Text>}
    </Tap>
  );
}

/** Por revisar, préstamos y metas: solo si hay algo (src/app/page.tsx y money-rows.tsx). */
export function HomeRows({
  pendingCount,
  money,
  onPending,
  onLoans,
  onGoals,
}: {
  pendingCount: number;
  money: { owedToMe: number; iOwe: number; saved: number };
  onPending?: () => void;
  onLoans?: () => void;
  onGoals?: () => void;
}) {
  const { colors } = useTheme();
  const loans = [money.owedToMe > 0 && `Te deben ${formatCOP(money.owedToMe)}`, money.iOwe > 0 && `Debes ${formatCOP(money.iOwe)}`].filter(Boolean);
  return (
    <View>
      {pendingCount > 0 && (
        <Row
          icon={<Tray size={16} color={colors.muted} />}
          label={pendingCount === 1 ? "1 movimiento por revisar" : `${pendingCount} movimientos por revisar`}
          onPress={onPending}
        />
      )}
      {loans.length > 0 && <Row icon={<Handshake size={16} color={colors.muted} />} label={loans.join(" · ")} onPress={onLoans} />}
      {money.saved > 0 && <Row icon={<PiggyBank size={16} color={colors.muted} />} label={`Apartado en metas ${formatCOP(money.saved)}`} onPress={onGoals} />}
    </View>
  );
}

const VISIBLE = 3;

/** Los recurrentes de los próximos 7 días y los que esperan en la bandeja (upcoming-charges.tsx). */
export function UpcomingList({ upcoming, categories, today }: { upcoming: UpcomingCharge[]; categories: Category[]; today: string }) {
  const { colors } = useTheme();
  if (upcoming.length === 0) return null;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const hidden = upcoming.length - VISIBLE;
  const when = (c: UpcomingCharge) => (c.pending ? "Por confirmar" : c.day === addDays(today, 1) ? "Mañana" : formatDay(c.day, today));

  return (
    <View style={{ marginTop: 24 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: 4 }}>
        <Text size={12} weight="medium" tone="muted" style={{ textTransform: "uppercase" }}>
          Próximos movimientos
        </Text>
        <Text size={12} weight="medium" tone="muted">
          7 días
        </Text>
      </View>
      <Divider />
      {upcoming.slice(0, VISIBLE).map((c) => {
        const category = c.categoryId ? byId.get(c.categoryId) : undefined;
        return (
          <View key={`${c.ruleId}:${c.day}:${c.pending}`}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 4 }}>
              <CategoryIcon category={category} color={categoryColor(colors, category?.color)} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1}>{c.description || category?.name || "Recurrente"}</Text>
                <Text size={12} tone="muted" numberOfLines={1}>
                  {when(c)}
                </Text>
              </View>
              <Text mono size={15} tracking={-0.3} tone={c.type === "income" ? "accent" : "foreground"}>
                {c.type === "income" ? "+" : "-"}
                {formatCOP(c.amount)}
              </Text>
            </View>
            <Divider />
          </View>
        );
      })}
      {hidden > 0 && (
        <Text size={12} tone="muted" style={{ paddingHorizontal: 4, paddingVertical: 12 }}>
          y {hidden} más
        </Text>
      )}
    </View>
  );
}
