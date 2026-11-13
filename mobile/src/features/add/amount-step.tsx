import * as Haptics from "expo-haptics";
import { View } from "react-native";
import { pressKey, type KeypadKey } from "@/lib/amount-keypad";
import { formatCOP } from "@/lib/money";
import type { TxType } from "@/lib/types";
import { useTheme } from "@/theme/theme";
import { Button } from "@/ui/button";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

const KEYS: KeypadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "back"];

/** Paso 1: el monto con el teclado propio (src/app/add/amount-step.tsx). */
export function AmountStep({
  type,
  onType,
  digits,
  onDigits,
  onNext,
}: {
  type: TxType;
  onType: (type: TxType) => void;
  digits: string;
  onDigits: (digits: string) => void;
  onNext: () => void;
}) {
  const { colors } = useTheme();
  const amount = Number(digits || 0);

  return (
    <View style={{ gap: 16 }}>
      <TypeSwitch type={type} onType={onType} />

      <Text
        accessibilityLabel={`Monto ${formatCOP(amount)}`}
        accessibilityLiveRegion="polite"
        tabular
        weight="bold"
        size={digits.length > 9 ? 36 : 48}
        leading={1.15}
        tracking={-1.2}
        align="center"
        tone={amount ? "foreground" : "muted"}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ paddingVertical: 16 }}
      >
        {formatCOP(amount)}
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {KEYS.map((key) => (
          <Tap
            key={key}
            accessibilityRole="button"
            accessibilityLabel={key === "back" ? "Borrar" : key}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onDigits(pressKey(digits, key));
            }}
            style={{
              width: "31.5%",
              flexGrow: 1,
              height: 56,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text size={24} weight="medium" tabular>
              {key === "back" ? "⌫" : key}
            </Text>
          </Tap>
        ))}
      </View>

      <Button label="Siguiente" variant="primary" height={56} disabled={!digits} onPress={onNext} />
    </View>
  );
}

/** Gasto / Ingreso: el ingreso se pinta con el acento, como en la web. */
export function TypeSwitch({ type, onType }: { type: TxType; onType: (type: TxType) => void }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
    >
      {(["expense", "income"] as const).map((t) => {
        const active = type === t;
        const background = active ? (t === "income" ? colors.accent : colors.foreground) : "transparent";
        const color = active ? (t === "income" ? colors.onAccent : colors.background) : colors.muted;
        return (
          <Tap
            key={t}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onType(t)}
            style={{ flex: 1, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: background }}
          >
            <Text size={14} weight="medium" style={{ color }}>
              {t === "expense" ? "Gasto" : "Ingreso"}
            </Text>
          </Tap>
        );
      })}
    </View>
  );
}
