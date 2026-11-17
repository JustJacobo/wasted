import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import type { BottomTabBarProps } from "expo-router/tabs";
import { CalendarCheckIcon, ChartBarIcon, HouseIcon, ListBulletsIcon, PlusIcon, type Icon } from "phosphor-react-native";
import { useState } from "react";
import { View } from "react-native";
import { api } from "@/core/api";
import type { HomeData } from "@/core/types";
import { useFeedback } from "@/features/add/feedback";
import { SavedToast } from "@/features/add/saved-toast";
import { useTheme } from "@/theme/theme";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

const TABS: Record<string, { label: string; icon: Icon }> = {
  index: { label: "Inicio", icon: HouseIcon },
  movimientos: { label: "Movimientos", icon: ListBulletsIcon },
  plan: { label: "Plan", icon: CalendarCheckIcon },
  reportes: { label: "Reportes", icon: ChartBarIcon },
};

export const openRegister = (tipo: "gasto" | "ingreso") => router.push({ pathname: "/registrar", params: { tipo } });

/**
 * La barra de abajo: cuatro pestañas y el ＋ al centro, que abre la ventana de
 * registro (mantenerlo presionado abre Ingreso). La confirmación de lo
 * guardado sale encima, en cualquier pestaña.
 */
export function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { colors } = useTheme();
  const feedback = useFeedback();
  const home = useQuery({ queryKey: ["home"], queryFn: () => api<HomeData>("home") });
  const [height, setHeight] = useState(0);

  const tab = (index: number) => {
    const route = state.routes[index];
    const meta = TABS[route.name];
    if (!meta) return null;
    const focused = state.index === index;
    const Glyph = meta.icon;
    return (
      <Tap
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        pressScale={0.94}
        onPress={() => {
          const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            Haptics.selectionAsync().catch(() => {});
            navigateToTab(route.key);
          }
        }}
        style={{ flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", gap: 2 }}
      >
        <Glyph size={24} weight={focused ? "fill" : "regular"} color={focused ? colors.foreground : colors.muted} />
        <Text size={11} weight={focused ? "semibold" : "medium"} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: focused ? colors.foreground : colors.muted }}>
          {meta.label}
        </Text>
      </Tap>
    );
  };

  return (
    <View
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      style={{ backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8), paddingTop: 6 }}
    >
      {feedback && home.data && (
        // Encima de la barra, sin empujar el contenido de la pestaña.
        <View pointerEvents="box-none" style={{ position: "absolute", left: 16, right: 16, bottom: height + 8 }}>
          <SavedToast feedback={feedback} categories={home.data.categories} />
        </View>
      )}
      <View accessibilityRole="tablist" style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
        {tab(0)}
        {tab(1)}
        <View style={{ flex: 1, alignItems: "center" }}>
          <Tap
            accessibilityRole="button"
            accessibilityLabel="Registrar gasto"
            accessibilityHint="Mantén presionado para registrar un ingreso"
            haptic
            pressScale={0.92}
            onPress={() => openRegister("gasto")}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              openRegister("ingreso");
            }}
            style={{ width: 56, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.foreground }}
          >
            <PlusIcon size={24} weight="bold" color={colors.background} />
          </Tap>
        </View>
        {tab(2)}
        {tab(3)}
      </View>
    </View>
  );
}
