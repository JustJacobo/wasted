import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { addDays, formatShortDay } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import type { Category, TxType } from "@/lib/types";
import { useTheme } from "@/theme/theme";
import { categoryColor, FONTS } from "@/theme/tokens";
import { Button } from "@/ui/button";
import { CategoryIcon } from "@/ui/category-icon";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

const toDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

/** Paso 2: fecha, nota opcional y la categoría, que al confirmar guarda (src/app/add/category-step.tsx). */
export function CategoryStep({
  type,
  amount,
  categories,
  today,
  date,
  onDate,
  note,
  onNote,
  selectedId,
  onSelect,
  onBack,
  onSubmit,
  pending,
  error,
}: {
  type: TxType;
  amount: number;
  categories: Category[];
  today: string;
  date: string;
  onDate: (date: string) => void;
  note: string;
  onNote: (note: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
}) {
  const { colors } = useTheme();
  const yesterday = addDays(today, -1);
  const isOther = date !== today && date !== yesterday;
  const [showNote, setShowNote] = useState(note !== "");
  const [picking, setPicking] = useState(false);
  const selected = categories.find((c) => c.id === selectedId);

  const segment = (label: string, active: boolean, onPress: () => void) => (
    <Tap
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{ flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: active ? colors.foreground : "transparent" }}
    >
      <Text size={14} weight="medium" numberOfLines={1} style={{ color: active ? colors.background : colors.foreground }}>
        {label}
      </Text>
    </Tap>
  );

  return (
    <View style={{ flexGrow: 1, gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Tap accessibilityRole="button" accessibilityLabel="Volver al monto" onPress={onBack} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Text size={20}>←</Text>
        </Tap>
        <Text size={24} weight="bold" tabular tracking={-0.6} tone={type === "income" ? "accent" : "foreground"} numberOfLines={1} style={{ flex: 1 }}>
          {type === "income" ? "+" : "-"}
          {formatCOP(amount)}
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        <Text size={14} tone="muted" style={{ paddingHorizontal: 4 }}>
          Fecha
        </Text>
        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
          {segment("Hoy", date === today, () => onDate(today))}
          {segment("Ayer", date === yesterday, () => onDate(yesterday))}
          {segment(isOther ? formatShortDay(date) : "Otra", isOther, () => setPicking(true))}
        </View>
        {picking && (
          <DateTimePicker
            value={fromDay(date)}
            mode="date"
            maximumDate={fromDay(today)}
            onChange={(event, value) => {
              setPicking(false);
              if (event.type === "set" && value) onDate(toDay(value));
            }}
          />
        )}
      </View>

      {showNote ? (
        <TextInput
          autoFocus
          value={note}
          onChangeText={onNote}
          maxLength={200}
          placeholder="Nota (opcional)"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Nota"
          returnKeyType="done"
          style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 16, color: colors.foreground, fontFamily: FONTS.regular, fontSize: 16 }}
        />
      ) : (
        <Tap accessibilityRole="button" onPress={() => setShowNote(true)} style={{ alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 4 }}>
          <Text size={14} tone="muted">
            + Nota (opcional)
          </Text>
        </Tap>
      )}

      <View style={{ gap: 8 }}>
        <Text size={14} tone="muted" style={{ paddingHorizontal: 4 }}>
          Categoría
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {categories.map((c) => {
            const active = c.id === selectedId;
            return (
              <Tap
                key={c.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={c.name}
                onPress={() => onSelect(c.id)}
                style={{
                  width: "31.5%",
                  flexGrow: 1,
                  minHeight: 80,
                  paddingVertical: 8,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  paddingHorizontal: 4,
                  backgroundColor: active ? colors.foreground : colors.background,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? colors.foreground : colors.border,
                }}
              >
                <CategoryIcon category={c} size={24} color={active ? colors.background : categoryColor(colors, c.color)} />
                {/* Dos líneas para "Suscripciones y plataformas"; una palabra sola se achica en vez de partirse ("Entretenimient/o"). */}
                <Text
                  size={12}
                  numberOfLines={/\s/.test(c.name.trim()) ? 2 : 1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  align="center"
                  style={{ color: active ? colors.background : colors.foreground }}
                >
                  {c.name}
                </Text>
              </Tap>
            );
          })}
        </View>
      </View>

      {/* Lo que sobra queda arriba: el botón de guardar, abajo, donde termina el pulgar. */}
      <View style={{ flexGrow: 1 }} />

      {error && (
        <Text accessibilityRole="alert" size={14} tone="danger">
          {error}
        </Text>
      )}

      <Button
        label={pending ? "Guardando…" : selected ? `Agregar ${type === "income" ? "ingreso" : "gasto"} · ${selected.name}` : "Elige una categoría"}
        variant={type === "income" ? "accent" : "primary"}
        height={56}
        disabled={!selected || pending}
        onPress={onSubmit}
      />
    </View>
  );
}
