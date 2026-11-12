import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sortByUsage } from "@/lib/category-usage";
import { formatDay, formatTime } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import type { Category } from "@/lib/types";
import { api, ApiError } from "@/core/api";
import { refreshAfterWrite } from "@/core/query";
import type { HomeData, ToClassifyItem } from "@/core/types";
import { useTheme } from "@/theme/theme";
import { categoryColor } from "@/theme/tokens";
import { Card } from "@/ui/card";
import { CategoryIcon } from "@/ui/category-icon";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

/**
 * Transferencias a personas ("Enviaste $15.000 a Juan Pérez"): ya cuentan en el
 * saldo, falta decir qué fueron. Un toque en la categoría y queda aprendido
 * para la próxima transferencia a esa persona. También wasted://clasificar.
 */
export default function ClassifyScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const home = useQuery({ queryKey: ["home"], queryFn: () => api<HomeData>("home") });
  const data = home.data;
  const options = useMemo(
    () => sortByUsage((data?.categories ?? []).filter((c) => c.type === "expense" && !c.archived), data?.transactions ?? []),
    [data],
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Tap accessibilityRole="button" onPress={() => router.back()} style={{ paddingVertical: 8, paddingRight: 12 }}>
          <Text size={14} tone="muted">
            ← Volver
          </Text>
        </Tap>
        <Text size={18} weight="bold" align="right" style={{ flex: 1 }} accessibilityRole="header">
          Por clasificar
        </Text>
      </View>

      {!data ? (
        <View style={{ paddingTop: 48, alignItems: "center" }}>
          {home.error ? <Text>{home.error.message}</Text> : <ActivityIndicator color={colors.foreground} />}
        </View>
      ) : data.toClassify.length === 0 ? (
        <Card style={{ paddingVertical: 40, paddingHorizontal: 20 }}>
          <Text size={14} tone="muted" align="center">
            Nada por clasificar. Cuando le envíes plata a alguien que la app no conoce, aparece aquí.
          </Text>
        </Card>
      ) : (
        <>
          <Text size={14} tone="muted">
            Ya cuentan en lo que te queda. Elige qué fue y la próxima transferencia a esa persona se clasifica sola.
          </Text>
          {data.toClassify.map((item) => (
            <ClassifyCard key={item.id} item={item} options={options} today={data.today} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function ClassifyCard({ item, options, today }: { item: ToClassifyItem; options: Category[]; today: string }) {
  const { colors } = useTheme();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (done) return null;

  async function choose(categoryId: string) {
    setSaving(categoryId);
    setError(null);
    try {
      const result = await api<{ error?: string }>("classifyTransaction", { id: item.id, categoryId });
      if (result?.error) setError(result.error);
      else {
        setDone(true);
        refreshAfterWrite();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pude guardarlo.");
    } finally {
      setSaving(null);
    }
  }

  const when = [formatDay(item.occurred_on, today), item.occurred_at && formatTime(item.occurred_at)].filter(Boolean).join(" · ");
  return (
    <Animated.View exiting={FadeOut.duration(150)}>
      <Card style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={2}>{item.merchant}</Text>
            <Text size={12} tone="muted" numberOfLines={1}>
              {when}
            </Text>
          </View>
          <Text weight="medium" tabular>
            -{formatCOP(item.amount)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {options.map((c) => (
            <Tap
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={`Fue ${c.name}`}
              disabled={saving !== null}
              onPress={() => choose(c.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                minHeight: 40,
                paddingHorizontal: 12,
                borderRadius: 20,
                backgroundColor: saving === c.id ? colors.foreground : colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: saving !== null && saving !== c.id ? 0.5 : 1,
              }}
            >
              <CategoryIcon category={c} size={16} color={saving === c.id ? colors.background : categoryColor(colors, c.color)} />
              <Text size={14} style={{ color: saving === c.id ? colors.background : colors.foreground }}>
                {c.name}
              </Text>
            </Tap>
          ))}
        </View>
        {error && (
          <Text size={14} tone="danger" accessibilityRole="alert">
            {error}
          </Text>
        )}
      </Card>
    </Animated.View>
  );
}
