import { useQuery } from "@tanstack/react-query";
import { router, useNavigation } from "expo-router";
import { GearSix } from "phosphor-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, useWindowDimensions, View, type ScrollViewInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/core/api";
import type { HomeData } from "@/core/types";
import { useFeedback } from "@/features/add/feedback";
import { SavedToast } from "@/features/add/saved-toast";
import { HomeRows, UpcomingList } from "@/features/home/rows";
import { SummaryCard } from "@/features/home/summary";
import { Dashboard } from "@/features/report/dashboard";
import { TransactionList } from "@/features/transactions/list";
import { useTheme } from "@/theme/theme";
import { Button } from "@/ui/button";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

/**
 * La ventana de registro se abre sola la primera vez que se entra en cada
 * arranque (como la web). No si la app abrió en otra pantalla (un enlace o un
 * acceso directo) que quedó encima del inicio.
 */
let openedOnLaunch = false;

const openRegister = (tipo: "gasto" | "ingreso") => router.push({ pathname: "/registrar", params: { tipo } });
const PANELS = ["Inicio", "Dashboard"] as const;
/** Espacio para la barra fija de abajo (− Gasto / + Ingreso). */
const BAR_SPACE = 160;

/** Inicio y Dashboard lado a lado (src/app/home-pager.tsx): se desliza o se toca la pestaña. */
export default function HomeScreen() {
  const { colors, setAppearance } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const feedback = useFeedback();
  const navigation = useNavigation();
  const pager = useRef<ScrollViewInstance>(null);
  const [panel, setPanel] = useState(0);
  const home = useQuery({ queryKey: ["home"], queryFn: () => api<HomeData>("home") });

  // El tema guardado en la cuenta manda (como en la web en un dispositivo nuevo).
  const appearance = home.data?.appearance;
  useEffect(() => {
    if (appearance) setAppearance(appearance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appearance?.accent, appearance?.mode]);

  useEffect(() => {
    if (home.data && !openedOnLaunch) {
      openedOnLaunch = true;
      if (navigation.isFocused()) openRegister("gasto");
    }
  }, [home.data, navigation]);

  if (home.isPending) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.foreground} />
      </View>
    );
  }
  if (home.error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16 }}>
        <Text align="center">{home.error.message}</Text>
        <Button label="Intentar de nuevo" onPress={() => home.refetch()} />
      </View>
    );
  }

  const data = home.data;
  // Las pestañas no deslizan: son pares, no una jerarquía (cambio inmediato).
  const goTo = (index: number) => {
    setPanel(index);
    pager.current?.scrollTo({ x: index * width, animated: false });
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 4 }}>
        {PANELS.map((label, i) => (
          <Tap
            key={label}
            accessibilityRole="tab"
            accessibilityState={{ selected: panel === i }}
            onPress={() => goTo(i)}
            style={{ paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 2, borderBottomColor: panel === i ? colors.foreground : "transparent" }}
          >
            <Text size={22} weight="bold" tracking={-0.5} tone={panel === i ? "foreground" : "muted"}>
              {label}
            </Text>
          </Tap>
        ))}
        <View style={{ flex: 1 }} />
        <Tap accessibilityRole="button" accessibilityLabel="Ajustes" onPress={() => router.push("/ajustes")} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <GearSix size={24} color={colors.muted} />
        </Tap>
      </View>

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPanel(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ width }}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: BAR_SPACE, paddingHorizontal: 16 }}
          refreshControl={<RefreshControl refreshing={home.isRefetching} onRefresh={() => void home.refetch()} tintColor={colors.foreground} />}
        >
          <Text size={14} tone="muted">
            Hola, {data.name.split(" ")[0]}
          </Text>
          <SummaryCard summary={data.summary} upcoming={data.upcoming} today={data.today} />
          <HomeRows pendingCount={data.pendingCount} money={data.money} onPending={() => router.push("/bandeja")}
            onLoans={() => router.push("/prestamos")}
            onGoals={() => router.push("/metas")}
          />
          <UpcomingList upcoming={data.upcoming} categories={data.categories} today={data.today} />
          <TransactionList transactions={data.transactions} categories={data.categories} today={data.today} />
          {data.transactions.length > 0 && (
            <Tap accessibilityRole="link" onPress={() => router.push("/movimientos")} style={{ marginTop: 16, paddingVertical: 12, alignItems: "center" }}>
              <Text size={14} weight="medium" tone="muted">
                Ver historial completo →
              </Text>
            </Tap>
          )}
        </ScrollView>
        <View style={{ width }}>
          <Dashboard
            today={data.today}
            bottomInset={BAR_SPACE}
            onCategory={(cat, mes) => router.push({ pathname: "/movimientos", params: { mes, cat, tipo: "gasto" } })}
          />
        </View>
      </ScrollView>

      {/* Barra fija: registrar siempre a un toque, con la confirmación encima. */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: Math.max(12, insets.bottom),
          gap: 12,
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        {feedback && <SavedToast feedback={feedback} categories={data.categories} />}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button label="− Gasto" variant="primary" height={52} style={{ flex: 1 }} onPress={() => openRegister("gasto")} />
          <Button label="+ Ingreso" height={52} style={{ flex: 1 }} onPress={() => openRegister("ingreso")} />
        </View>
      </View>
    </View>
  );
}
