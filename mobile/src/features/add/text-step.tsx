import { useMemo, useState } from "react";
import { TextInput, View } from "react-native";
import { formatDay } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { isGoalIntent, parseMoneyMove } from "@/lib/money-moves";
import { matchCategory, type CategoryRule } from "@/lib/quick-add/categorize";
import { parseQuickAdd } from "@/lib/quick-add/parse";
import type { Category } from "@/lib/types";
import { api, ApiError } from "@/core/api";
import { useTheme } from "@/theme/theme";
import { FONTS } from "@/theme/tokens";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";
import type { QuickAddState } from "./types";

/** Modo secundario: "25k almuerzo", "le presté 20k a Juan" (src/app/add/text-step.tsx). */
export function TextStep({
  categories,
  rules,
  today,
  onDone,
}: {
  categories: Category[];
  rules: CategoryRule[];
  today: string;
  onDone: (result: Exclude<QuickAddState, { status: "error" }>) => void;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const preview = useMemo(() => parseQuickAdd(text), [text]);
  // Solo lo que seguro es préstamo o meta; un pago o "saqué" puede terminar siendo un gasto normal.
  const move = useMemo(() => {
    const intent = parseMoneyMove(text);
    if (!intent) return null;
    if (isGoalIntent(intent)) return intent.kind === "save" && intent.canCreate ? intent : null;
    return intent.kind === "lend" || intent.kind === "borrow" ? intent : null;
  }, [text]);
  const previewCategory = useMemo(() => {
    if (!preview) return null;
    const id = matchCategory(preview.description, preview.type, categories, rules);
    return categories.find((c) => c.id === id) ?? null;
  }, [preview, categories, rules]);

  async function submit() {
    const value = text.trim();
    if (!value || pending) return;
    if (!preview) {
      setError("Falta el monto. Prueba con “25k almuerzo”.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const result = await api<QuickAddState>("quickAdd", { text: value });
      if (result.status === "error") setError(result.error);
      else onDone(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pude guardar. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }

  const hint = pending
    ? "Guardando…"
    : move
      ? isGoalIntent(move)
        ? `Apartar para ${move.goal} · ${formatCOP(move.amount)}`
        : `Préstamo · ${move.person || "¿con quién?"} · ${formatCOP(move.amount)}`
      : preview
        ? `${preview.type === "income" ? "Ingreso" : "Gasto"} · ${formatCOP(preview.amount)} · ${formatDay(preview.occurredOn, today)}` +
          (previewCategory ? ` · ${previewCategory.name}` : "")
        : "";

  return (
    <View style={{ gap: 12 }}>
      <Text size={14} tone="muted" style={{ paddingHorizontal: 4 }}>
        Escribe el monto y en qué fue: <Text size={14} weight="semibold">25k almuerzo</Text>,{" "}
        <Text size={14} weight="semibold">+200k cuota semanal</Text>, <Text size={14} weight="semibold">ayer 6k yango</Text>.
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          autoFocus
          value={text}
          onChangeText={setText}
          placeholder="25k almuerzo"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="send"
          onSubmitEditing={submit}
          maxLength={200}
          accessibilityLabel="Nuevo gasto o ingreso"
          style={{ flex: 1, height: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 16, color: colors.foreground, fontFamily: FONTS.regular, fontSize: 16 }}
        />
        <Tap
          accessibilityRole="button"
          accessibilityLabel="Guardar"
          haptic
          disabled={!text.trim() || pending}
          onPress={submit}
          style={{ width: 52, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.foreground }}
        >
          <Text size={20} style={{ color: colors.background }}>
            →
          </Text>
        </Tap>
      </View>
      <Text size={12} tone="muted" tabular numberOfLines={1} accessibilityLiveRegion="polite" style={{ minHeight: 16, paddingHorizontal: 4 }}>
        {hint}
      </Text>
      {error && (
        <Text accessibilityRole="alert" size={14} tone="danger">
          {error}
        </Text>
      )}
    </View>
  );
}
