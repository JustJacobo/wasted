import { useState } from "react";
import { TextInput, type TextInputProps, type StyleProp, type TextStyle } from "react-native";
import { groupThousands } from "@/lib/money";
import { useTheme } from "@/theme/theme";
import { FONTS } from "@/theme/tokens";
import { Text } from "./text";

/** Campo de texto con el estilo de la app: 48 dp, 16 sp (sin zoom) y borde fino. */
export function Field({ style, ...props }: TextInputProps & { style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[
        { height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 16, color: colors.foreground, fontFamily: FONTS.regular, fontSize: 16 },
        style,
      ]}
    />
  );
}

/** Monto con separador de miles mientras se escribe; `value` es el número. */
export function useAmount(initial: number | null = null) {
  const [text, setText] = useState(initial ? groupThousands(String(initial)) : "");
  return {
    text,
    value: Number(text.replace(/\D/g, "")),
    onChangeText: (t: string) => setText(groupThousands(t.replace(/\D/g, "").slice(0, 12))),
    reset: () => setText(""),
  };
}

export function AmountField({ amount, ...props }: { amount: ReturnType<typeof useAmount> } & Omit<TextInputProps, "value" | "onChangeText">) {
  return <Field keyboardType="number-pad" value={amount.text} onChangeText={amount.onChangeText} placeholder="$ 0" style={{ fontVariant: ["tabular-nums"] }} {...props} />;
}

/** Aviso de resultado: neutro o de error. */
export function Notice({ text, error }: { text: string; error?: boolean }) {
  const { colors } = useTheme();
  return (
    <Text
      accessibilityRole={error ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      size={14}
      tone={error ? "danger" : "foreground"}
      style={{ borderRadius: 12, padding: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: error ? colors.danger : colors.border }}
    >
      {text}
    </Text>
  );
}
