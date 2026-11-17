import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { todayIn } from "@/lib/dates";
import { api } from "@/core/api";
import type { HomeData } from "@/core/types";
import { Dashboard } from "@/features/report/dashboard";
import { ScreenHeader } from "@/ui/header";

/** Reportes (el Dashboard): la semana o el mes, por día y por categoría. */
export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  // El inicio ya trajo la fecha del servidor; sin él, la de Colombia en el teléfono.
  const home = useQuery({ queryKey: ["home"], queryFn: () => api<HomeData>("home") });
  const today = home.data?.today ?? todayIn();
  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Dashboard
        today={today}
        header={<ScreenHeader root title="Reportes" />}
        onCategory={(cat, mes) => router.navigate({ pathname: "/movimientos", params: { mes, cat, tipo: "gasto" } })}
      />
    </View>
  );
}
