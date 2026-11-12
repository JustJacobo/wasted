import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDay, formatShortDay, timeInputValue } from "@/lib/dates";
import { groupThousands } from "@/lib/money";
import { frequencyLabel, type Frequency, type Recurring } from "@/lib/recurring";
import type { Category, Transaction, TxType } from "@/lib/types";
import { api, ApiError } from "@/core/api";
import { refreshAfterWrite } from "@/core/query";
import { TypeSwitch } from "@/features/add/amount-step";
import { FrequencyPicker } from "@/features/recurring/frequency-picker";
import { useTheme } from "@/theme/theme";
import { categoryColor, FONTS } from "@/theme/tokens";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { CategoryIcon } from "@/ui/category-icon";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

interface TransactionData {
  today: string;
  transaction: Transaction | null;
  categories: Category[];
  rule: Recurring | null;
}

const toDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromDay = (day: string, time = "12:00") => {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min);
};

/** Editar, borrar o repetir un movimiento (src/app/movimientos/[id]/). */
export default function TransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const query = useQuery({ queryKey: ["transaction", id], queryFn: () => api<TransactionData>("transaction", { id }) });

  if (query.isPending) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.foreground} />
      </View>
    );
  }
  const tx = query.data?.transaction;
  if (query.error || !tx) return <Missing message={query.error?.message ?? "Este movimiento ya no existe."} />;
  return <EditForm key={tx.id} data={query.data as TransactionData & { transaction: Transaction }} />;
}

function Header() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Tap accessibilityRole="button" onPress={() => router.back()} style={{ paddingVertical: 8, paddingRight: 12 }}>
        <Text size={14} tone="muted">
          ← Volver
        </Text>
      </Tap>
      <Text size={18} weight="bold" align="right" style={{ flex: 1 }} accessibilityRole="header">
        Editar movimiento
      </Text>
    </View>
  );
}

function Missing({ message }: { message: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, padding: 16, paddingTop: insets.top + 8, gap: 16 }}>
      <Header />
      <Text>{message}</Text>
    </View>
  );
}

function EditForm({ data }: { data: TransactionData & { transaction: Transaction } }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { transaction: tx, categories, rule, today } = data;

  const [type, setType] = useState<TxType>(tx.type);
  const [amount, setAmount] = useState(groupThousands(String(tx.amount)));
  const [description, setDescription] = useState(tx.description);
  const [categoryId, setCategoryId] = useState(tx.category_id);
  const [day, setDay] = useState(tx.occurred_on);
  const [time, setTime] = useState(tx.occurred_at ? timeInputValue(tx.occurred_at) : "");
  const [picking, setPicking] = useState<"date" | "time" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = categories.filter((c) => c.type === type && (!c.archived || c.id === tx.category_id));
  const selected = options.some((c) => c.id === categoryId) ? categoryId : null;
  const digits = amount.replace(/\D/g, "");

  const refresh = refreshAfterWrite;

  async function save() {
    if (!selected || !Number(digits)) {
      setError("Revisa el monto y la categoría.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await api<{ error?: string } | null>("updateTransaction", {
        id: tx.id,
        type,
        amount: Number(digits),
        description,
        category_id: selected,
        occurred_on: day,
        occurred_time: time,
      });
      if (result?.error) setError(result.error);
      else {
        await refresh();
        router.back();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pude guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  function remove() {
    Alert.alert("¿Borrar este movimiento?", "Deja de contar en tu saldo y en los reportes.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          try {
            await api("deleteTransaction", { id: tx.id });
          } catch (e) {
            setError(e instanceof ApiError ? e.message : "No pude borrar el movimiento.");
            return;
          }
          await refresh();
          router.back();
        },
      },
    ]);
  }

  const field = { height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 16, color: colors.foreground, fontFamily: FONTS.regular, fontSize: 16 } as const;
  const label = (text: string) => (
    <Text size={14} tone="muted" style={{ paddingHorizontal: 4 }}>
      {text}
    </Text>
  );

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, gap: 16 }}>
      <Header />
      <TypeSwitch
        type={type}
        onType={(t) => {
          setType(t);
          setCategoryId(null);
        }}
      />
      <View style={{ gap: 6 }}>
        {label("Monto")}
        <TextInput
          value={amount}
          onChangeText={(t) => setAmount(groupThousands(t.replace(/\D/g, "").slice(0, 12)))}
          keyboardType="number-pad"
          accessibilityLabel="Monto"
          style={[field, { fontVariant: ["tabular-nums"] }]}
        />
      </View>
      <View style={{ gap: 6 }}>
        {label("Descripción")}
        <TextInput
          value={description}
          onChangeText={setDescription}
          maxLength={200}
          multiline
          submitBehavior="blurAndSubmit"
          placeholder="Opcional"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Descripción"
          style={[field, { height: undefined, minHeight: 48, maxHeight: 168, paddingVertical: 12, textAlignVertical: "center" }]}
        />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1, gap: 6 }}>
          {label("Fecha")}
          <Tap accessibilityRole="button" accessibilityLabel={`Fecha: ${formatDay(day, today)}`} onPress={() => setPicking("date")} style={[field, { justifyContent: "center" }]}>
            <Text>{formatShortDay(day)}</Text>
          </Tap>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          {label("Hora")}
          <Tap accessibilityRole="button" accessibilityLabel={time ? `Hora: ${time}` : "Sin hora"} onPress={() => setPicking("time")} style={[field, { justifyContent: "center" }]}>
            <Text tone={time ? "foreground" : "muted"}>{time || "Sin hora"}</Text>
          </Tap>
        </View>
      </View>
      {picking && (
        <DateTimePicker
          value={fromDay(day, time || "12:00")}
          mode={picking}
          is24Hour
          maximumDate={picking === "date" ? fromDay(today) : undefined}
          onChange={(event, value) => {
            const mode = picking;
            setPicking(null);
            if (event.type !== "set" || !value) return;
            if (mode === "date") setDay(toDay(value));
            else setTime(`${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`);
          }}
        />
      )}
      {time !== "" && (
        <Tap accessibilityRole="button" onPress={() => setTime("")} style={{ alignSelf: "flex-end", paddingVertical: 4, paddingHorizontal: 4 }}>
          <Text size={14} tone="muted">
            Quitar la hora
          </Text>
        </Tap>
      )}

      <View style={{ gap: 6 }}>
        {label("Categoría")}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {options.map((c) => {
            const active = c.id === selected;
            return (
              <Tap
                key={c.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => setCategoryId(c.id)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: active ? colors.foreground : colors.surface, borderWidth: active ? 0 : 1, borderColor: colors.border }}
              >
                <CategoryIcon category={c} size={16} color={active ? colors.background : categoryColor(colors, c.color)} />
                <Text size={14} style={{ color: active ? colors.background : colors.foreground }}>
                  {c.name}
                </Text>
              </Tap>
            );
          })}
        </View>
      </View>

      {error && (
        <Text size={14} tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Button label={saving ? "Guardando…" : "Guardar cambios"} variant="primary" height={52} disabled={saving} onPress={save} />

      <Repeat transaction={tx} rule={rule} today={today} onSaved={refresh} />

      <Button label="Borrar movimiento" variant="danger" height={48} onPress={remove} />
    </ScrollView>
  );
}

/** "Repetir": convierte el movimiento en recurrente, o muestra cada cuánto se repite (repeat-section.tsx). */
function Repeat({ transaction, rule, today, onSaved }: { transaction: Transaction; rule: Recurring | null; today: string; onSaved: () => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [freq, setFreq] = useState<Frequency>({ every: 1, unit: "month" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const result = await api<{ error?: string }>("makeRecurring", { transactionId: transaction.id, ...freq });
      if (result.error) setError(result.error);
      else {
        setOpen(false);
        await onSaved();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pude guardarlo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <Text size={14} tone="muted" style={{ paddingHorizontal: 4 }}>
        Repetir
      </Text>
      {rule ? (
        <Card style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text numberOfLines={1}>{frequencyLabel(rule.starts_on, rule)}</Text>
          <Text size={12} tone="muted">
            {rule.paused ? "Pausado" : `Próximo: ${rule.next_on === today ? "hoy" : formatShortDay(rule.next_on)}`}
          </Text>
        </Card>
      ) : !open ? (
        <Tap accessibilityRole="button" pressScale={0.99} onPress={() => setOpen(true)}>
          <Card style={{ height: 48, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text>No se repite</Text>
            <Text tone="muted">›</Text>
          </Card>
        </Tap>
      ) : (
        <Card style={{ padding: 12, gap: 12 }}>
          <FrequencyPicker value={freq} onChange={setFreq} />
          <Text size={12} tone="muted">
            {frequencyLabel(transaction.occurred_on, freq)}. Cuando llegue la fecha aparece en Por revisar con lo guardado de este movimiento.
          </Text>
          {error && (
            <Text size={14} tone="danger">
              {error}
            </Text>
          )}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button label="Cancelar" style={{ flex: 1 }} onPress={() => setOpen(false)} />
            <Button label="Repetir" variant="primary" style={{ flex: 1 }} loading={saving} onPress={save} />
          </View>
        </Card>
      )}
    </View>
  );
}
