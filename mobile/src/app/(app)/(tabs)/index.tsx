import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useNavigation } from "expo-router";
import { GearSixIcon } from "phosphor-react-native";
import { useEffect } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { todayIn } from "@/lib/dates";
import { api } from "@/core/api";
import { mark } from "@/core/perf";
import type { HomeData } from "@/core/types";
import { HomeRows, UpcomingList } from "@/features/home/rows";
import { SummaryCard } from "@/features/home/summary";
import { openRegister } from "@/features/nav/tab-bar";
import { TransactionList } from "@/features/transactions/list";
import { useTheme } from "@/theme/theme";
import { Button } from "@/ui/button";
import { ScreenHeader } from "@/ui/header";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

/**
 * La ventana de registro se abre sola la primera vez que se entra en cada
 * arranque (como la web). No si la app abrió en otra pantalla (un enlace o un
 * acceso directo) que quedó encima del inicio.
 */
let openedOnLaunch = false;

/** Inicio (src/app/page.tsx): lo que queda, lo que viene y lo último registrado. */
export default function HomeScreen() {
  const { colors, setAppearance } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const home = useQuery({ queryKey: ["home"], queryFn: () => api<HomeData>("home") });

  // El tema guardado en la cuenta manda (como en la web en un dispositivo nuevo).
  const appearance = home.data?.appearance;
  useEffect(() => {
    if (appearance) setAppearance(appearance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appearance?.accent, appearance?.mode]);

  const client = useQueryClient();
  // Lo que se pide nuevo usa la fecha del teléfono: el inicio guardado puede ser de días atrás.
  const today = todayIn();
  const ready = Boolean(home.data);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      client.prefetchQuery({ queryKey: ["report", "semana", today], queryFn: () => api("report", { kind: "semana", anchor: today }) }).catch(() => {});
      client.prefetchQuery({ queryKey: ["plan"], queryFn: () => api("plan") }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [client, today, ready]);

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
  mark(home.isFetchedAfterMount ? "inicio con datos del servidor" : "inicio con datos guardados");
  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 32, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={home.isRefetching} onRefresh={() => void home.refetch()} tintColor={colors.foreground} />}
      >
        <ScreenHeader
          root
          title={`Hola, ${data.name.split(" ")[0]}`}
          action={
            <Tap accessibilityRole="button" accessibilityLabel="Ajustes" onPress={() => router.push("/ajustes")} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 }}>
              <GearSixIcon size={24} color={colors.muted} />
            </Tap>
          }
        />
        <SummaryCard summary={data.summary} upcoming={data.upcoming} today={data.today} />
        <HomeRows
          pendingCount={data.pendingCount}
          classifyCount={data.toClassify?.length ?? 0}
          money={data.money}
          onPending={() => router.push("/bandeja")}
          onClassify={() => router.push("/clasificar")}
          onLoans={() => router.push("/prestamos")}
          onGoals={() => router.push("/metas")}
        />
        <UpcomingList
          upcoming={data.upcoming}
          categories={data.categories}
          today={today}
          onPay={(c) =>
            router.push({ pathname: "/registrar", params: { tipo: c.type === "income" ? "ingreso" : "gasto", recurrente: c.ruleId, ocurrencia: c.occurrence } })
          }
        />
        <TransactionList transactions={data.transactions} categories={data.categories} today={today} />
        {data.transactions.length > 0 && (
          <Tap accessibilityRole="link" onPress={() => router.navigate("/movimientos")} style={{ marginTop: 16, paddingVertical: 12, alignItems: "center" }}>
            <Text size={14} weight="medium" tone="muted">
              Ver historial completo →
            </Text>
          </Tap>
        )}
      </ScrollView>
    </View>
  );
}
