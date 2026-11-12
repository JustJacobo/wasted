import { useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";
import { formatDay } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import type { Category } from "@/lib/types";
import { api, ApiError } from "@/core/api";
import { refreshAfterWrite } from "@/core/query";
import { useTheme } from "@/theme/theme";
import { categoryColor } from "@/theme/tokens";
import { Button } from "@/ui/button";
import { CategoryIcon } from "@/ui/category-icon";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";
import { PROVIDERS, type PendingItem } from "./cards";

/**
 * Categorías como fichas en vez de un select (más cómodo con el dedo). La que
 * trae el movimiento va primero para que se vea sin desplazar; el orden no
 * cambia al elegir otra.
 */
function CategoryChips({ options, value, onChange }: { options: Category[]; value: string; onChange: (id: string) => void }) {
  const { colors } = useTheme();
  const [first] = useState(value);
  const ordered = [...options.filter((c) => c.id === first), ...options.filter((c) => c.id !== first)];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {ordered.map((c) => {
        const active = c.id === value;
        return (
          <Tap
            key={c.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(c.id)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: active ? colors.foreground : colors.background, borderWidth: active ? 0 : 1, borderColor: colors.border }}
          >
            <CategoryIcon category={c} size={16} color={active ? colors.background : categoryColor(colors, c.color)} />
            <Text size={14} style={{ color: active ? colors.background : colors.foreground }}>
              {c.name}
            </Text>
          </Tap>
        );
      })}
    </ScrollView>
  );
}

/** Lo que tienen en común las dos tarjetas: correr la acción, refrescar y desaparecer. */
function useAct() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  async function act(op: string, input: unknown) {
    setPending(true);
    setError(null);
    try {
      const result = await api<{ error?: string } | null>(op, input);
      if (result?.error) setError(result.error);
      else {
        setDone(true);
        refreshAfterWrite();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pude guardarlo.");
    } finally {
      setPending(false);
    }
  }
  return { pending, error, done, act };
}

/** Un movimiento por confirmar: categoría editable, Agregar o Descartar (pending-row.tsx). */
export function PendingRow({ item, categories, today }: { item: PendingItem; categories: Category[]; today: string }) {
  const { colors } = useTheme();
  const options = categories.filter((c) => c.type === item.type && (!c.archived || c.id === item.category_id));
  const [categoryId, setCategoryId] = useState(item.category_id ?? options[0]?.id ?? "");
  const { pending, error, done, act } = useAct();
  if (done) return null;

  const category = categories.find((c) => c.id === categoryId);
  const similar = item.similar;
  const fromPhone = item.source === "notification";
  const linked = Boolean(item.recurring_id) && item.source !== "recurring";
  const recurring = item.source === "recurring" || linked;
  const origin = linked
    ? ["Recurrente", formatDay(item.occurred_on, today), `${fromPhone ? "de una notificación" : "del correo"}${item.merchant ? ` (${item.merchant})` : ""}`]
    : [
        fromPhone ? `Notificación de ${PROVIDERS[item.provider ?? ""] ?? "tu teléfono"}` : (PROVIDERS[item.provider ?? "otro"] ?? "Correo"),
        formatDay(item.occurred_on, today),
        item.frequency && item.frequency.charAt(0).toLowerCase() + item.frequency.slice(1),
      ].filter(Boolean);
  const priceChanged = linked && item.ruleAmount !== null && item.ruleAmount !== Number(item.amount);
  const similarCategory = similar?.category_id ? categories.find((c) => c.id === similar.category_id) : undefined;

  return (
    <Animated.View exiting={FadeOut.duration(150)} style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <CategoryIcon category={category} color={colors.muted} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2}>{item.description || item.merchant || "Movimiento"}</Text>
          <Text size={12} tone="muted" numberOfLines={1}>
            {origin.join(" · ")}
          </Text>
        </View>
        <Text weight="medium" tabular tone={item.type === "income" ? "accent" : "foreground"}>
          {item.type === "income" ? "+" : "-"}
          {formatCOP(Number(item.amount))}
        </Text>
      </View>
      {priceChanged && (
        <Text size={12} tone="muted">
          Antes era {formatCOP(item.ruleAmount!)}; al agregarlo, el recurrente pasa a {formatCOP(Number(item.amount))}.
        </Text>
      )}
      {similar && (
        <View style={{ borderRadius: 12, padding: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.vizWarn }}>
          <Text size={14}>
            ⚠️ ¿Ya lo registraste? Se parece a{" "}
            <Text size={14} weight="medium">
              {similar.description || similarCategory?.name || "un movimiento"} {formatCOP(Number(similar.amount))}
            </Text>{" "}
            ({formatDay(similar.occurred_on, today).toLowerCase()}).
          </Text>
        </View>
      )}
      <CategoryChips options={options} value={categoryId} onChange={setCategoryId} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label={similar ? "Ya lo tenía" : recurring ? "Esta vez no" : "Descartar"} variant="danger" style={{ flex: 1 }} disabled={pending} onPress={() => act("discardPending", { id: item.id })} />
        <Button label={similar ? "Es otro, agregar" : "Agregar"} variant="primary" style={{ flex: 1 }} disabled={pending || !categoryId} onPress={() => act("confirmPending", { id: item.id, categoryId })} />
      </View>
      {error && (
        <Text size={14} tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      )}
    </Animated.View>
  );
}

/** Un recurrente y un cobro importado que quizás son el mismo: una tarjeta, un toque (pending-pair.tsx). */
export function PendingPair({ recurring, mail, categories, today }: { recurring: PendingItem; mail: PendingItem; categories: Category[]; today: string }) {
  const { colors } = useTheme();
  const options = categories.filter((c) => c.type === recurring.type && (!c.archived || c.id === recurring.category_id));
  const [categoryId, setCategoryId] = useState(recurring.category_id ?? mail.category_id ?? options[0]?.id ?? "");
  const { pending, error, done, act } = useAct();
  if (done) return null;

  const sign = recurring.type === "income" ? "+" : "-";
  const amountChanged = Number(mail.amount) !== Number(recurring.amount);
  const frequency = recurring.frequency && recurring.frequency.charAt(0).toLowerCase() + recurring.frequency.slice(1);
  const line = (label: string, title: string, detail: string, amount: number) => (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      <Text size={12} tone="muted" style={{ width: 84, paddingTop: 2 }}>
        {label}
      </Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2}>{title}</Text>
        <Text size={12} tone="muted" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Text weight="medium" tabular tone={recurring.type === "income" ? "accent" : "foreground"}>
        {sign}
        {formatCOP(amount)}
      </Text>
    </View>
  );

  return (
    <Animated.View exiting={FadeOut.duration(150)} style={{ padding: 16, gap: 12 }}>
      <Text weight="medium">¿Es el mismo cobro?</Text>
      <View style={{ gap: 12, borderRadius: 12, padding: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
        {line("Recurrente", recurring.description || "Recurrente", [formatDay(recurring.occurred_on, today), frequency].filter(Boolean).join(" · "), Number(recurring.amount))}
        {line(mail.source === "notification" ? "Notificación" : "Del correo", mail.merchant || mail.description || "Movimiento", formatDay(mail.occurred_on, today), Number(mail.amount))}
      </View>
      <Text size={12} tone="muted">
        Si es el mismo, se agrega una vez con el monto y la fecha {mail.source === "notification" ? "de la notificación" : "del correo"}
        {amountChanged && ` y el recurrente pasa a ${formatCOP(Number(mail.amount))}`}.
      </Text>
      <CategoryChips options={options} value={categoryId} onChange={setCategoryId} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label="Son distintos" style={{ flex: 1 }} disabled={pending} onPress={() => act("splitPending", { ids: [recurring.id, mail.id] })} />
        <Button label="Es el mismo, agregar" variant="primary" style={{ flex: 1 }} disabled={pending || !categoryId} onPress={() => act("mergePending", { recurringTxId: recurring.id, mailTxId: mail.id, categoryId })} />
      </View>
      {error && (
        <Text size={14} tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      )}
    </Animated.View>
  );
}
