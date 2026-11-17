import { Tabs } from "expo-router/tabs";
import { TabBar } from "@/features/nav/tab-bar";
import { useTheme } from "@/theme/theme";

/**
 * Las cuatro pestañas. Cambiar de pestaña es inmediato (se hace decenas de
 * veces al día). Cada una se monta la primera vez que se abre y se congela
 * mientras no se ve.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, lazy: true, freezeOnBlur: true, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="movimientos" />
      <Tabs.Screen name="plan" />
      <Tabs.Screen name="reportes" />
    </Tabs>
  );
}
