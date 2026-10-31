import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/theme/theme";
import { FONTS } from "@/theme/tokens";

type Tone = "foreground" | "muted" | "danger" | "accent" | "onAccent";
type Weight = "regular" | "medium" | "semibold" | "bold";

export interface Props extends TextProps {
  size?: number;
  weight?: Weight;
  tone?: Tone;
  /** Cifras alineadas (montos en columnas). */
  tabular?: boolean;
  mono?: boolean;
  /** Interlineado relativo al tamaño. */
  leading?: number;
  tracking?: number;
  align?: TextStyle["textAlign"];
}

/** Texto con Geist y los colores del tema. Tamaños en sp: respeta la letra grande del teléfono. */
export function Text({
  size = 16,
  weight = "regular",
  tone = "foreground",
  tabular,
  mono,
  leading = 1.35,
  tracking,
  align,
  style,
  ...props
}: Props) {
  const { colors } = useTheme();
  const color = { foreground: colors.foreground, muted: colors.muted, danger: colors.danger, accent: colors.accentInk, onAccent: colors.onAccent }[tone];
  return (
    <RNText
      {...props}
      style={[
        {
          color,
          fontSize: size,
          lineHeight: Math.round(size * leading),
          fontFamily: mono ? FONTS.mono : FONTS[weight],
          fontVariant: tabular ? ["tabular-nums"] : undefined,
          letterSpacing: tracking,
          textAlign: align,
        },
        style,
      ]}
    />
  );
}
