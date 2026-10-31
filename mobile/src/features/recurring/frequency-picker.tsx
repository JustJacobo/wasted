import { useState } from "react";
import { TextInput, View } from "react-native";
import { MAX_EVERY, PRESETS, sameFrequency, UNITS, unitName, type Frequency, type FrequencyUnit } from "@/lib/recurring";
import { useTheme } from "@/theme/theme";
import { FONTS } from "@/theme/tokens";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

/** Cada semana, cada mes… y "Otra" para cada N días, semanas, meses o años (frequency-picker.tsx de la web). */
export function FrequencyPicker({ value, onChange }: { value: Frequency; onChange: (value: Frequency) => void }) {
  const { colors } = useTheme();
  const [custom, setCustom] = useState(!PRESETS.some((p) => sameFrequency(p.freq, value)));
  const [every, setEvery] = useState(String(value.every));

  const chip = (label: string, active: boolean, onPress: () => void) => (
    <Tap
      key={label}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{ height: 40, justifyContent: "center", paddingHorizontal: 12, borderRadius: 20, backgroundColor: active ? colors.foreground : colors.background, borderWidth: active ? 0 : 1, borderColor: colors.border }}
    >
      <Text size={14} style={{ color: active ? colors.background : colors.foreground }}>
        {label}
      </Text>
    </Tap>
  );

  return (
    <View style={{ gap: 12 }}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Cada cuánto" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {PRESETS.map((p) =>
          chip(p.label, !custom && sameFrequency(p.freq, value), () => {
            setCustom(false);
            setEvery(String(p.freq.every));
            onChange(p.freq);
          }),
        )}
        {chip("Otra…", custom, () => setCustom(true))}
      </View>
      {custom && (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text size={14} tone="muted">
              Cada
            </Text>
            <TextInput
              accessibilityLabel="Cantidad"
              keyboardType="number-pad"
              value={every}
              onChangeText={(t) => {
                const digits = t.replace(/\D/g, "").slice(0, 3);
                setEvery(digits);
                const n = Number(digits);
                if (n >= 1) onChange({ every: Math.min(n, MAX_EVERY[value.unit]), unit: value.unit });
              }}
              onBlur={() => setEvery(String(value.every))}
              style={{ width: 64, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, textAlign: "center", color: colors.foreground, fontFamily: FONTS.regular, fontSize: 16 }}
            />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {UNITS.map((u: FrequencyUnit) =>
              chip(unitName(u, value.every), value.unit === u, () => {
                const n = Math.min(value.every, MAX_EVERY[u]);
                setEvery(String(n));
                onChange({ every: n, unit: u });
              }),
            )}
          </View>
        </View>
      )}
    </View>
  );
}
