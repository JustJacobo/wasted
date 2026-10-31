import { View, type ViewProps } from "react-native";
import { useTheme } from "@/theme/theme";

/** Superficie con borde fino, como `rounded-xl bg-surface ring-1 ring-border` en la web. */
export function Card({ style, ...props }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      {...props}
      style={[
        { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
        style,
      ]}
    />
  );
}

/** Línea divisoria entre filas de una lista. */
export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}
