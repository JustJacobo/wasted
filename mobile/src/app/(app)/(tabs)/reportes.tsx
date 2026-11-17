import { router } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { todayIn } from "@/lib/dates";
import { Dashboard } from "@/features/report/dashboard";
import { ScreenHeader } from "@/ui/header";

/** Reportes (el Dashboard): la semana o el mes, por día y por categoría. */
export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  // La fecha del teléfono (hora de Colombia): lo guardado puede ser de días atrás.
  const today = todayIn();
  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Dashboard
        today={today}
        header={<ScreenHeader root title="Reportes" />}
        // `n` distingue cada toque: la pestaña sigue montada y vuelve a filtrar aunque sea la misma barra.
        onCategory={(cat, mes) => router.navigate({ pathname: "/movimientos", params: { mes, cat, tipo: "gasto", n: String(Date.now()) } })}
      />
    </View>
  );
}
