import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sortByUsage } from "@/lib/category-usage";
import type { TxType } from "@/lib/types";
import { api, ApiError } from "@/core/api";
import { refreshAfterWrite } from "@/core/query";
import type { HomeData } from "@/core/types";
import { AmountStep } from "@/features/add/amount-step";
import { CategoryStep } from "@/features/add/category-step";
import { showFeedback } from "@/features/add/feedback";
import { TextStep } from "@/features/add/text-step";
import type { QuickAddState } from "@/features/add/types";
import { useTheme } from "@/theme/theme";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

type View_ = "amount" | "category" | "text";

/** Cada paso entra con un fundido corto; con movimiento reducido, sin desplazamiento. */
const enter = FadeIn.duration(200).reduceMotion(ReduceMotion.System);

/**
 * La ventana de registro (hoja nativa): monto con el teclado, luego la
 * categoría, que guarda. El ⌨ abre el modo texto. Se arrastra hacia abajo o
 * con Atrás para cerrar (src/app/add/add-sheet.tsx).
 */
export default function RegisterSheet() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tipo?: string }>();
  const home = useQuery({ queryKey: ["home"], queryFn: () => api<HomeData>("home") });

  const [view, setView] = useState<View_>("amount");
  const [type, setType] = useState<TxType>(params.tipo === "ingreso" ? "income" : "expense");
  const [digits, setDigits] = useState("");
  const today = home.data?.today ?? "";
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(
    () =>
      sortByUsage(
        (home.data?.categories ?? []).filter((c) => c.type === type && !c.archived),
        home.data?.transactions ?? [],
      ),
    [home.data, type],
  );

  function done(result: Exclude<QuickAddState, { status: "error" }>) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    showFeedback(
      result.status === "ok"
        ? { kind: "saved", transaction: result.transaction, week: result.week, similar: result.similar }
        : { kind: "moved", message: result.message },
    );
    refreshAfterWrite();
    router.back();
  }

  async function submit() {
    if (!selectedId || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await api<QuickAddState>("addTransaction", {
        type,
        amount: Number(digits),
        categoryId: selectedId,
        description: note,
        occurredOn: date || today,
      });
      if (result.status === "error") setError(result.error);
      else done(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pude guardar. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }

  const title = view === "text" ? "Escribir rápido" : type === "income" ? "Nuevo ingreso" : "Nuevo gasto";

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 16 }}
      style={{ backgroundColor: colors.surface }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Text accessibilityRole="header" size={18} weight="semibold" style={{ flex: 1 }}>
          {title}
        </Text>
        <Tap
          accessibilityRole="button"
          accessibilityLabel={view === "text" ? "Usar botones" : "Escribir rápido"}
          onPress={() => setView(view === "text" ? "amount" : "text")}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Text size={view === "text" ? 14 : 20} tone="muted" weight="medium">
            {view === "text" ? "123" : "⌨"}
          </Text>
        </Tap>
        <Tap accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Text size={20} tone="muted">
            ✕
          </Text>
        </Tap>
      </View>

      <Animated.View key={view} entering={enter}>
        {view === "text" ? (
          <TextStep categories={home.data?.categories ?? []} rules={home.data?.rules ?? []} today={today} onDone={done} />
        ) : view === "amount" ? (
          <AmountStep
            type={type}
            onType={(next) => {
              setType(next);
              setSelectedId(null);
            }}
            digits={digits}
            onDigits={setDigits}
            onNext={() => setView("category")}
          />
        ) : (
          <CategoryStep
            type={type}
            amount={Number(digits)}
            categories={options}
            today={today}
            date={date || today}
            onDate={setDate}
            note={note}
            onNote={setNote}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onBack={() => setView("amount")}
            onSubmit={submit}
            pending={pending}
            error={error}
          />
        )}
      </Animated.View>
    </ScrollView>
  );
}
