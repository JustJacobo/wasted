import { router } from "expo-router";
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { Tap } from "./tap";
import { Text } from "./text";

/** Pantalla con "← Volver", título a la derecha, desplazamiento y deslizar para recargar. */
export function Screen({
  title,
  back = "← Volver",
  loading,
  error,
  refreshing,
  onRefresh,
  children,
}: {
  title: string;
  back?: string;
  loading?: boolean;
  error?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // El desplazamiento empieza bajo la barra de estado: el contenido no pasa por debajo de la hora.
  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: insets.bottom + 32, gap: 16 }}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.foreground} /> : undefined}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* Desde un enlace o un acceso directo no hay pantalla atrás: vuelve al inicio. */}
          <Tap accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={{ paddingVertical: 8, paddingRight: 12 }}>
            <Text size={14} tone="muted">
              {back}
            </Text>
          </Tap>
          <Text size={18} weight="bold" tracking={-0.3} align="right" style={{ flex: 1 }} accessibilityRole="header">
            {title}
          </Text>
        </View>
        {loading || error ? (
          <View style={{ paddingTop: 48, alignItems: "center" }}>{error ? <Text>{error}</Text> : <ActivityIndicator color={colors.foreground} />}</View>
        ) : (
          children
        )}
      </ScrollView>
    </View>
  );
}
