import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, View } from "react-native";
import { formatShortDay } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { frequencyLabel, type Frequency, type Recurring } from "@/lib/recurring";
import type { Category, TxType } from "@/lib/types";
import { api } from "@/core/api";
import { useAction } from "@/core/use-action";
import { TypeSwitch } from "@/features/add/amount-step";
import { FrequencyPicker } from "@/features/recurring/frequency-picker";
import { useTheme } from "@/theme/theme";
import { categoryColor } from "@/theme/tokens";
import { Button } from "@/ui/button";
import { Card, Divider } from "@/ui/card";
import { CategoryIcon } from "@/ui/category-icon";
import { AmountField, Field, Notice, useAmount } from "@/ui/fields";
import { Screen } from "@/ui/screen";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

interface RecurringData {
  today: string;
  recurring: Recurring[];
  categories: Category[];
}

const toDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

/** Arriendo, suscripciones, la cuota semanal (src/app/ajustes/recurrentes/). */
export default function RecurringScreen() {
  const { colors } = useTheme();
  const query = useQuery({ queryKey: ["recurring"], queryFn: () => api<RecurringData>("recurring") });
  const action = useAction();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const data = query.data;

  const row = (r: Recurring, i: number) => {
    const category = data?.categories.find((c) => c.id === r.category_id);
    return (
      <View key={r.id}>
        {i > 0 && <Divider />}
        {editing === r.id && data ? (
          <RecurringForm
            initial={r}
            categories={data.categories}
            today={data.today}
            pending={action.pending}
            onCancel={() => setEditing(null)}
            onSubmit={(input) => action.run("updateRecurring", { ...input, id: r.id }, () => setEditing(null))}
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button label={r.paused ? "Reanudar" : "Pausar"} style={{ flex: 1 }} onPress={() => action.run("setRecurringPaused", { id: r.id, paused: !r.paused }, () => setEditing(null))} />
              <Button
                label="Eliminar"
                variant="danger"
                style={{ flex: 1 }}
                onPress={() =>
                  Alert.alert(`¿Eliminar “${r.description || category?.name || "este recurrente"}”?`, "Lo ya agregado se queda.", [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Eliminar", style: "destructive", onPress: () => action.run("deleteRecurring", { id: r.id }, () => setEditing(null)) },
                  ])
                }
              />
            </View>
          </RecurringForm>
        ) : (
          <Tap accessibilityRole="button" pressScale={0.99} onPress={() => setEditing(r.id)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, opacity: r.paused ? 0.6 : 1 }}>
            <CategoryIcon category={category} color={categoryColor(colors, category?.color)} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} tone={r.paused ? "muted" : "foreground"}>
                {r.description || category?.name || "Sin nombre"}
              </Text>
              <Text size={12} tone="muted" numberOfLines={1}>
                {frequencyLabel(r.starts_on, r)}
                {!r.paused && ` · Próximo: ${r.next_on === data?.today ? "hoy" : formatShortDay(r.next_on)}`}
              </Text>
            </View>
            <Text mono size={15} tone={r.type === "income" ? "accent" : "foreground"}>
              {r.type === "income" ? "+" : "-"}
              {formatCOP(Number(r.amount))}
            </Text>
          </Tap>
        )}
      </View>
    );
  };

  const active = data?.recurring.filter((r) => !r.paused) ?? [];
  const paused = data?.recurring.filter((r) => r.paused) ?? [];

  return (
    <Screen title="Recurrentes" back="← Ajustes" loading={!data && !query.error} error={query.error?.message} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      {data && (
        <>
          <Text size={14} tone="muted">
            Arriendo, suscripciones, la cuota semanal. Cuando llega la fecha aparecen en Por revisar y cuentan en tu saldo al agregarlos.
          </Text>
          {action.notice && <Notice text={action.notice.text} error={action.notice.error} />}
          {active.length > 0 ? (
            <Card>{active.map(row)}</Card>
          ) : (
            editing !== "new" && (
              <Card style={{ paddingVertical: 32, paddingHorizontal: 20 }}>
                <Text size={14} tone="muted" align="center">
                  No tienes recurrentes. También puedes crear uno desde un movimiento: tócalo en el historial y elige Repetir.
                </Text>
              </Card>
            )
          )}
          {editing === "new" ? (
            <Card>
              <RecurringForm
                initial={null}
                categories={data.categories}
                today={data.today}
                pending={action.pending}
                onCancel={() => setEditing(null)}
                onSubmit={(input) => action.run("createRecurring", input, () => setEditing(null))}
              />
            </Card>
          ) : (
            <Button label="Nuevo recurrente" onPress={() => setEditing("new")} />
          )}
          {paused.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text size={14} tone="muted" style={{ paddingHorizontal: 4 }}>
                En pausa
              </Text>
              <Card>{paused.map(row)}</Card>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function RecurringForm({
  initial,
  categories,
  today,
  pending,
  onSubmit,
  onCancel,
  children,
}: {
  initial: Recurring | null;
  categories: Category[];
  today: string;
  pending: boolean;
  onSubmit: (input: { type: TxType; amount: number; description: string; categoryId: string; nextOn: string; every: number; unit: Frequency["unit"] }) => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [type, setType] = useState<TxType>(initial?.type ?? "expense");
  const amount = useAmount(initial ? Number(initial.amount) : null);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id ?? null);
  const [freq, setFreq] = useState<Frequency>({ every: initial?.every ?? 1, unit: initial?.unit ?? "month" });
  const [nextOn, setNextOn] = useState(initial?.next_on ?? today);
  const [picking, setPicking] = useState(false);

  const options = categories.filter((c) => c.type === type && (!c.archived || c.id === initial?.category_id));
  const selected = options.some((c) => c.id === categoryId) ? categoryId : null;
  const ready = amount.value > 0 && description.trim() !== "" && selected !== null;

  return (
    <View style={{ padding: 12, gap: 12 }}>
      <TypeSwitch
        type={type}
        onType={(t) => {
          setType(t);
          setCategoryId(null);
        }}
      />
      <AmountField amount={amount} autoFocus={!initial} accessibilityLabel="Monto" />
      <Field value={description} onChangeText={setDescription} maxLength={200} placeholder="Nombre, como Arriendo" accessibilityLabel="Nombre" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((c) => {
          const active = c.id === selected;
          return (
            <Tap
              key={c.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => setCategoryId(c.id)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: active ? colors.foreground : colors.background, borderWidth: active ? 0 : 1, borderColor: colors.border }}
            >
              <CategoryIcon category={c} size={16} color={active ? colors.background : categoryColor(colors, c.color)} />
              <Text size={14} style={{ color: active ? colors.background : colors.foreground }}>
                {c.name}
              </Text>
            </Tap>
          );
        })}
      </View>
      <FrequencyPicker value={freq} onChange={setFreq} />
      <Tap accessibilityRole="button" onPress={() => setPicking(true)} style={{ minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text tone="muted">Próxima fecha</Text>
        <Text>{nextOn === today ? "Hoy" : formatShortDay(nextOn)}</Text>
      </Tap>
      {picking && (
        <DateTimePicker
          value={fromDay(nextOn)}
          mode="date"
          minimumDate={fromDay(today)}
          onChange={(event, value) => {
            setPicking(false);
            if (event.type === "set" && value) setNextOn(toDay(value));
          }}
        />
      )}
      <Text size={12} tone="muted">
        {frequencyLabel(nextOn, freq)}.
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label="Cancelar" style={{ flex: 1 }} onPress={onCancel} />
        <Button
          label="Guardar"
          variant="primary"
          style={{ flex: 1 }}
          disabled={!ready || pending}
          onPress={() => selected && onSubmit({ type, amount: amount.value, description: description.trim(), categoryId: selected, nextOn, every: freq.every, unit: freq.unit })}
        />
      </View>
      {children}
    </View>
  );
}
