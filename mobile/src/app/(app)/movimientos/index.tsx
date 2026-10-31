import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { DownloadSimple } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { addDays, formatMonth } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import type { Category, Transaction } from "@/lib/types";
import { api } from "@/core/api";
import { shareCsv } from "@/core/share-csv";
import { TransactionList } from "@/features/transactions/list";
import { useTheme } from "@/theme/theme";
import { categoryColor, FONTS } from "@/theme/tokens";
import { CategoryIcon } from "@/ui/category-icon";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

interface HistoryData {
  today: string;
  current: string;
  month: string;
  tipo: "todos" | "gasto" | "ingreso";
  categoryId: string | null;
  query: string;
  transactions: Transaction[];
  categories: Category[];
}

type Filters = { mes?: string; tipo?: string; cat?: string; q?: string };

/** Historial: un mes con filtros y búsqueda, y el CSV de lo que se ve (src/app/movimientos/page.tsx). */
export default function HistoryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Filters>();
  const [filters, setFilters] = useState<Filters>({ mes: params.mes, tipo: params.tipo, cat: params.cat });
  const [text, setText] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // La búsqueda espera 300 ms después de la última tecla, como en la web.
  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => ({ ...f, q: text.trim() || undefined })), 300);
    return () => clearTimeout(timer);
  }, [text]);

  const history = useQuery({
    queryKey: ["history", filters],
    queryFn: () => api<HistoryData>("history", filters),
    placeholderData: (previous) => previous,
  });
  const data = history.data;
  const set = (changes: Filters) => setFilters((f) => ({ ...f, ...changes }));

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      await shareCsv(filters);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "No pude exportar.");
    } finally {
      setExporting(false);
    }
  }

  const arrow = (label: string, a11y: string, onPress?: () => void) => (
    <Tap accessibilityRole="button" accessibilityLabel={a11y} disabled={!onPress} onPress={onPress} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: onPress ? 1 : 0.2 }}>
      <Text size={22}>{label}</Text>
    </Tap>
  );

  if (!data) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {history.error ? <Text>{history.error.message}</Text> : <ActivityIndicator color={colors.foreground} />}
      </View>
    );
  }

  const expense = data.transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const income = data.transactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const filtered = data.tipo !== "todos" || data.categoryId !== null || data.query !== "";
  const prevMonth = addDays(`${data.month}-01`, -1).slice(0, 7);
  const nextMonth = addDays(`${data.month}-28`, 7).slice(0, 7);
  const categories = data.categories.filter((c) => !c.archived && (data.tipo === "todos" || c.type === (data.tipo === "gasto" ? "expense" : "income")));

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: 16, gap: 16 }}
      refreshControl={<RefreshControl refreshing={history.isRefetching} onRefresh={() => void history.refetch()} tintColor={colors.foreground} />}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Tap accessibilityRole="button" onPress={() => router.back()} style={{ paddingVertical: 8, paddingRight: 12 }}>
          <Text size={14} tone="muted">
            ← Volver
          </Text>
        </Tap>
        <Text size={18} weight="bold" tracking={-0.3} align="right" style={{ flex: 1 }} accessibilityRole="header">
          Historial
        </Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {arrow("‹", "Mes anterior", () => set({ mes: prevMonth }))}
        <Text weight="semibold">{formatMonth(`${data.month}-01`)}</Text>
        {arrow("›", "Mes siguiente", data.month >= data.current ? undefined : () => set({ mes: nextMonth }))}
      </View>

      <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
        {(["todos", "gasto", "ingreso"] as const).map((t) => (
          <Tap
            key={t}
            accessibilityRole="tab"
            accessibilityState={{ selected: data.tipo === t }}
            onPress={() => set({ tipo: t === "todos" ? undefined : t, cat: undefined })}
            style={{ flex: 1, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: data.tipo === t ? colors.foreground : "transparent" }}
          >
            <Text size={14} weight="medium" style={{ color: data.tipo === t ? colors.background : colors.muted }}>
              {t === "todos" ? "Todo" : t === "gasto" ? "Gastos" : "Ingresos"}
            </Text>
          </Tap>
        ))}
      </View>

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Buscar: uber, mercado…"
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        autoCorrect={false}
        maxLength={100}
        accessibilityLabel="Buscar en las descripciones"
        style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 16, color: colors.foreground, fontFamily: FONTS.regular, fontSize: 16 }}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -16 }}>
        <View style={{ width: 8 }} />
        {[{ id: null, name: "Todas" } as const, ...categories].map((c) => {
          const active = data.categoryId === c.id;
          const category = c.id ? (c as Category) : undefined;
          return (
            <Tap
              key={c.id ?? "todas"}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => set({ cat: c.id ?? undefined })}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: active ? colors.foreground : colors.surface, borderWidth: active ? 0 : 1, borderColor: colors.border }}
            >
              {category && <CategoryIcon category={category} size={16} color={active ? colors.background : categoryColor(colors, category.color)} />}
              <Text size={14} style={{ color: active ? colors.background : colors.foreground }}>
                {c.name}
              </Text>
            </Tap>
          );
        })}
        <View style={{ width: 8 }} />
      </ScrollView>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text size={14} tone="muted" tabular style={{ flex: 1 }} accessibilityLiveRegion="polite">
          {data.transactions.length} {data.transactions.length === 1 ? "movimiento" : "movimientos"}
          {expense > 0 && (
            <>
              {" · Gastos "}
              <Text size={14}>{formatCOP(expense)}</Text>
            </>
          )}
          {income > 0 && (
            <>
              {" · Ingresos "}
              <Text size={14}>{formatCOP(income)}</Text>
            </>
          )}
        </Text>
        {data.transactions.length > 0 && (
          <Tap
            accessibilityRole="button"
            accessibilityLabel={`Exportar ${filtered ? "lo filtrado de " : ""}${formatMonth(`${data.month}-01`)} en CSV`}
            disabled={exporting}
            onPress={exportCsv}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 8 }}
          >
            <DownloadSimple size={16} color={colors.muted} />
            <Text size={14} tone="muted">
              {exporting ? "…" : "CSV"}
            </Text>
          </Tap>
        )}
      </View>
      {exportError && (
        <Text size={14} tone="danger" accessibilityRole="alert">
          {exportError}
        </Text>
      )}

      <View style={{ marginTop: -24 }}>
        <TransactionList
          transactions={data.transactions}
          categories={data.categories}
          today={data.today}
          empty={filtered ? "Nada con estos filtros." : "No hay movimientos en este mes."}
        />
      </View>
    </ScrollView>
  );
}
