import { ActivityIndicator, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/theme";
import { Tap } from "./tap";
import { Text } from "./text";

type Variant = "primary" | "secondary" | "accent" | "danger";

/** Botón de 44 dp o más (meta táctil), con el estilo de la web: tinta llena o contorno. */
export function Button({
  label,
  onPress,
  variant = "secondary",
  disabled,
  loading,
  height = 44,
  style,
  haptic = variant !== "secondary",
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const filled = variant === "primary" || variant === "accent";
  const background = variant === "primary" ? colors.foreground : variant === "accent" ? colors.accent : "transparent";
  const tone = variant === "primary" ? colors.background : variant === "accent" ? colors.onAccent : variant === "danger" ? colors.danger : colors.foreground;
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled || loading}
      haptic={haptic}
      style={[
        {
          minHeight: height,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 16,
          backgroundColor: background,
          borderWidth: filled ? 0 : 1,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone} />
      ) : (
        <Text size={15} weight="medium" style={{ color: tone }}>
          {label}
        </Text>
      )}
    </Tap>
  );
}
