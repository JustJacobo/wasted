import { router } from "expo-router";
import { CaretLeftIcon } from "phosphor-react-native";
import { View } from "react-native";
import { useTheme } from "@/theme/theme";
import { Tap } from "./tap";
import { Text } from "./text";

/** Desde un enlace o un acceso directo no hay pantalla atrás: vuelve al inicio. */
export const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

/**
 * Encabezado de pantalla. Las raíces de pestaña (Inicio, Movimientos, Plan,
 * Reportes) llevan el título grande; las pantallas apiladas, la flecha y el
 * título al lado. `action` va a la derecha (un ícono, "Administrar").
 */
export function ScreenHeader({ title, root, action }: { title: string; root?: boolean; action?: React.ReactNode }) {
  const { colors } = useTheme();
  if (root) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48 }}>
        <Text size={28} weight="bold" tracking={-0.8} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flex: 1 }} accessibilityRole="header">
          {title}
        </Text>
        {action}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 48, marginLeft: -10 }}>
      <Tap accessibilityRole="button" accessibilityLabel="Volver" onPress={goBack} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
        <CaretLeftIcon size={24} color={colors.foreground} />
      </Tap>
      <Text size={20} weight="semibold" tracking={-0.4} numberOfLines={2} style={{ flex: 1 }} accessibilityRole="header">
        {title}
      </Text>
      {action}
    </View>
  );
}
