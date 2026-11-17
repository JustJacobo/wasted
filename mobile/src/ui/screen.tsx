import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { ScreenHeader } from "./header";
import { Text } from "./text";

/**
 * Pantalla con encabezado, desplazamiento y deslizar para recargar. `root`
 * para las raíces de pestaña (sin flecha, título grande; la barra de abajo ya
 * reserva su espacio).
 */
export function Screen({
  title,
  root,
  action,
  loading,
  error,
  refreshing,
  onRefresh,
  children,
}: {
  title: string;
  root?: boolean;
  action?: React.ReactNode;
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
        contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: root ? 32 : insets.bottom + 32, gap: 16 }}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.foreground} /> : undefined}
      >
        <ScreenHeader title={title} root={root} action={action} />
        {loading || error ? (
          <View style={{ paddingTop: 48, alignItems: "center" }}>{error ? <Text>{error}</Text> : <ActivityIndicator color={colors.foreground} />}</View>
        ) : (
          children
        )}
      </ScrollView>
    </View>
  );
}
