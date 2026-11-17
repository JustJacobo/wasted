import { useQuery } from "@tanstack/react-query";
import { KeyboardIcon, XIcon } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sortByUsage } from "@/lib/category-usage";
import { chargeName, matchingCharges, payableCharges, payableForRule, payDate } from "@/lib/recurring-suggest";
import type { TxType } from "@/lib/types";
import type { UpcomingCharge } from "@/lib/week-plan";
import { api, ApiError } from "@/core/api";
import { refreshAfterWrite } from "@/core/query";
import type { HomeData } from "@/core/types";
import { AmountStep } from "@/features/add/amount-step";
import { CategoryStep } from "@/features/add/category-step";
import { showFeedback } from "@/features/add/feedback";
import { DueChips, PayToggle } from "@/features/add/recurring";
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
 * categoría, que guarda. El teclado abre el modo texto. Se arrastra hacia abajo o
 * con Atrás para cerrar (src/app/add/add-sheet.tsx).
 */
export default function RegisterSheet() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    tipo?: string;
    recurrente?: string;
    ocurrencia?: string;
    dia?: string;
    /** Desde el Plan, que muestra todo el mes: lo necesario para pagar una fecha que no está en los próximos 7 días. */
    monto?: string;
    nombre?: string;
    categoria?: string;
    tx?: string;
  }>();
  const home = useQuery({ queryKey: ["home"], queryFn: () => api<HomeData>("home") });

  // Desde "Próximos movimientos" o el Plan (/registrar?recurrente=<regla>&ocurrencia=<fecha>) abre listo para
  // marcarlo pagado. Normalmente el inicio ya trajo los datos; si no (un enlace en frío), se aplica cuando lleguen.
  const fromPlan: UpcomingCharge | null =
    params.recurrente && params.ocurrencia && Number(params.monto) > 0
      ? {
          ruleId: params.recurrente,
          occurrence: params.ocurrencia,
          day: params.dia ?? params.ocurrencia,
          type: params.tipo === "ingreso" ? "income" : "expense",
          amount: Number(params.monto),
          description: params.nombre ?? "",
          categoryId: params.categoria ?? null,
          pending: !!params.tx,
          txId: params.tx ?? null,
        }
      : null;
  const startFrom = (data: HomeData | undefined) => {
    if (!params.recurrente) return null;
    const exact = data?.upcoming.find((c) => c.ruleId === params.recurrente && c.occurrence === params.ocurrencia);
    return exact ?? fromPlan ?? (data ? payableForRule(data.upcoming, params.recurrente) : null);
  };
  const [start] = useState(() => startFrom(home.data));
  const [waiting, setWaiting] = useState(!!params.recurrente && !start);
  const usable = (charge: UpcomingCharge | null) =>
    charge && home.data?.categories.some((c) => c.id === charge.categoryId && !c.archived) ? charge.categoryId : null;

  const [view, setView] = useState<View_>(start ? "category" : "amount");
  const [type, setType] = useState<TxType>(start?.type ?? (params.tipo === "ingreso" ? "income" : "expense"));
  const [digits, setDigits] = useState(start ? String(start.amount) : "");
  const today = home.data?.today ?? "";
  const [date, setDate] = useState(start ? payDate(start, today) : today);
  const [note, setNote] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => usable(start));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** El recurrente que se marca pagado al guardar, o null para un registro normal. */
  const [paying, setPaying] = useState<UpcomingCharge | null>(start);

  const options = useMemo(
    () =>
      sortByUsage(
        (home.data?.categories ?? []).filter((c) => c.type === type && !c.archived),
        home.data?.transactions ?? [],
      ),
    [home.data, type],
  );

  const upcoming = home.data?.upcoming ?? [];
  const categories = home.data?.categories ?? [];
  const amount = Number(digits || 0);
  const due = payableCharges(upcoming, type);
  // Sin elegir una ficha, el que coincide con el monto escrito se ofrece apagado.
  const suggestion = paying ?? matchingCharges(upcoming, type, amount)[0] ?? null;

  /** Una ficha de "Vence pronto": monto y categoría del recurrente, listo para marcarlo pagado. */
  function pick(charge: UpcomingCharge) {
    setType(charge.type);
    setDigits(String(charge.amount));
    setDate(payDate(charge, today));
    setSelectedId(usable(charge));
    setPaying(charge);
    setView("category");
  }

  if (waiting && home.data) {
    setWaiting(false);
    const late = startFrom(home.data);
    if (late) pick(late);
    else setDate(home.data.today);
  }

  function togglePaying() {
    if (paying) return setPaying(null);
    if (!suggestion) return;
    setPaying(suggestion);
    if (!selectedId && options.some((c) => c.id === suggestion.categoryId)) setSelectedId(suggestion.categoryId);
  }

  function done(result: Exclude<QuickAddState, { status: "error" }>) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    showFeedback(
      result.status === "ok"
        ? { kind: "saved", transaction: result.transaction, week: result.week, similar: result.similar, paid: result.paid }
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
      const fields = { amount, categoryId: selectedId, description: note, occurredOn: date || today };
      const result = paying
        ? await api<QuickAddState>("payRecurring", { ...fields, ruleId: paying.ruleId, txId: paying.txId, occurrence: paying.occurrence })
        : await api<QuickAddState>("addTransaction", { ...fields, type });
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
          {view === "text" ? (
            <Text size={14} tone="muted" weight="medium">
              123
            </Text>
          ) : (
            <KeyboardIcon size={24} color={colors.muted} />
          )}
        </Tap>
        <Tap accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <XIcon size={22} color={colors.muted} />
        </Tap>
      </View>

      <Animated.View key={view} entering={enter}>
        {view === "text" ? (
          <TextStep categories={categories} rules={home.data?.rules ?? []} today={today} onDone={done} />
        ) : view === "amount" ? (
          <AmountStep
            type={type}
            onType={(next) => {
              setType(next);
              setSelectedId(null);
              setPaying(null);
            }}
            digits={digits}
            onDigits={setDigits}
            onNext={() => setView("category")}
            due={<DueChips charges={due} categories={categories} today={today} onPick={pick} />}
          />
        ) : (
          <CategoryStep
            type={type}
            amount={amount}
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
            paying={paying ? chargeName(paying, categories.find((c) => c.id === paying.categoryId)) : null}
            payToggle={
              suggestion && (
                <PayToggle
                  charge={suggestion}
                  category={categories.find((c) => c.id === suggestion.categoryId)}
                  today={today}
                  active={paying !== null}
                  onToggle={togglePaying}
                />
              )
            }
          />
        )}
      </Animated.View>
    </ScrollView>
  );
}
