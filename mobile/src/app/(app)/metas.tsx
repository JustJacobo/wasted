import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, View } from "react-native";
import { formatCOP } from "@/lib/money";
import type { GoalSummary } from "@/lib/money-moves";
import { api } from "@/core/api";
import { useAction } from "@/core/use-action";
import { useTheme } from "@/theme/theme";
import { Button } from "@/ui/button";
import { Card, Divider } from "@/ui/card";
import { AmountField, Field, Notice, useAmount } from "@/ui/fields";
import { Screen } from "@/ui/screen";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

const percent = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 0 });

/** Apartar plata para algo: sale de lo que te queda sin contar como gasto (src/app/metas/). */
export default function GoalsScreen() {
  const query = useQuery({ queryKey: ["goals"], queryFn: () => api<{ items: GoalSummary[]; total: number }>("goals") });
  const action = useAction();
  const [creating, setCreating] = useState(false);
  const data = query.data;
  const active = data?.items.filter((g) => !g.goal.archived) ?? [];
  const archived = data?.items.filter((g) => g.goal.archived) ?? [];

  return (
    <Screen title="Metas" loading={!data && !query.error} error={query.error?.message} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      {data && (
        <>
          <Card style={{ padding: 16 }}>
            <Text size={14} tone="muted">
              Apartado
            </Text>
            <Text size={24} weight="semibold" tabular tracking={-0.6}>
              {formatCOP(data.total)}
            </Text>
          </Card>
          {action.notice && <Notice text={action.notice.text} error={action.notice.error} />}

          {active.length === 0 && !creating && (
            <Card style={{ paddingVertical: 32, paddingHorizontal: 20 }}>
              <Text size={14} tone="muted" align="center">
                Aún no tienes metas. Crea una para apartar plata para algo: un viaje, un portátil, un colchón.
              </Text>
            </Card>
          )}
          {active.map((item) => (
            <GoalCard key={item.goal.id} item={item} action={action} />
          ))}

          {creating ? (
            <NewGoal pending={action.pending} onCancel={() => setCreating(false)} onSubmit={(name, target) => action.run("createGoal", { name, target }, () => setCreating(false))} />
          ) : (
            <Button label="Nueva meta" onPress={() => setCreating(true)} />
          )}

          {archived.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text size={14} tone="muted" style={{ paddingHorizontal: 4 }}>
                Archivadas
              </Text>
              <Card>
                {archived.map(({ goal }, i) => (
                  <View key={goal.id}>
                    {i > 0 && <Divider />}
                    <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: 16 }}>
                      <Text tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                        {goal.name}
                      </Text>
                      <Tap accessibilityRole="button" onPress={() => action.run("archiveGoal", { id: goal.id, archived: false })} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 16 }}>
                        <Text size={14}>Reactivar</Text>
                      </Tap>
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          )}
          <Text size={12} tone="muted">
            Lo apartado sale de lo que te queda, sin contar como gasto. Al sacarlo vuelve a tu saldo. También puedes escribir “aparté 50k para el viaje” en Telegram o en el modo ⌨.
          </Text>
        </>
      )}
    </Screen>
  );
}

function GoalCard({ item, action }: { item: GoalSummary; action: ReturnType<typeof useAction> }) {
  const { colors } = useTheme();
  const { goal, saved, progress } = item;
  const [mode, setMode] = useState<"save" | "withdraw" | "target" | null>(null);
  const amount = useAmount();
  const target = useAmount(goal.target);

  const removeOrArchive = () => {
    if (saved > 0) {
      Alert.alert(`¿Borrar ${goal.name}?`, `Los ${formatCOP(saved)} apartados vuelven a tu saldo.`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Borrar", style: "destructive", onPress: () => action.run("deleteGoal", { id: goal.id }) },
      ]);
    } else {
      action.run("archiveGoal", { id: goal.id, archived: true });
    }
  };

  return (
    <Card style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Text weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>
          {goal.name}
        </Text>
        <Text size={14} tone="muted" tabular>
          {goal.target ? `${percent.format(progress ?? 0)} de ${formatCOP(goal.target)}` : "Sin meta"}
        </Text>
      </View>
      <Text size={24} weight="semibold" tabular tracking={-0.6}>
        {formatCOP(Math.max(0, saved))}
      </Text>
      {progress !== null && (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`Avance de ${goal.name}`}
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
          style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" }}
        >
          <View style={{ height: "100%", width: `${progress * 100}%`, borderRadius: 3, backgroundColor: colors.viz }} />
        </View>
      )}
      {progress !== null && progress >= 1 && <Text size={14}>Lo lograste: ya tienes lo que te propusiste.</Text>}

      {mode === "save" || mode === "withdraw" ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <AmountField amount={amount} autoFocus accessibilityLabel={mode === "save" ? "Cuánto apartas" : "Cuánto sacas"} style={{ flex: 1 }} />
          <Button
            label={mode === "save" ? "Apartar" : "Sacar"}
            variant="primary"
            height={48}
            disabled={!amount.value || action.pending}
            onPress={() => action.run("moveGoal", { goalId: goal.id, kind: mode, amount: amount.value }, () => setMode(null))}
          />
          <Button label="×" height={48} accessibilityLabel="Cancelar" onPress={() => setMode(null)} />
        </View>
      ) : mode === "target" ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <AmountField amount={target} autoFocus placeholder="Sin meta" accessibilityLabel="Meta" style={{ flex: 1 }} />
          <Button label="Guardar" variant="primary" height={48} disabled={action.pending} onPress={() => action.run("setGoalTarget", { goalId: goal.id, target: target.value || null }, () => setMode(null))} />
          <Button label="×" height={48} accessibilityLabel="Cancelar" onPress={() => setMode(null)} />
        </View>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button label="Apartar" variant="primary" style={{ flex: 1 }} onPress={() => setMode("save")} />
            <Button label="Sacar" style={{ flex: 1 }} disabled={saved <= 0} onPress={() => setMode("withdraw")} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Tap accessibilityRole="button" onPress={() => setMode("target")} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text size={14} tone="muted">
                {goal.target ? "Cambiar meta" : "Ponerle meta"}
              </Text>
            </Tap>
            <Tap accessibilityRole="button" onPress={removeOrArchive} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text size={14} tone="muted">
                {saved > 0 ? "Borrar" : "Archivar"}
              </Text>
            </Tap>
          </View>
        </>
      )}
    </Card>
  );
}

function NewGoal({ pending, onSubmit, onCancel }: { pending: boolean; onSubmit: (name: string, target: number | null) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const target = useAmount();
  return (
    <Card style={{ padding: 12, gap: 12 }}>
      <Field autoFocus value={name} onChangeText={setName} placeholder="Viaje, portátil, colchón…" maxLength={60} accessibilityLabel="Nombre" />
      <AmountField amount={target} placeholder="Cuánto quieres juntar (opcional)" accessibilityLabel="Cuánto quieres juntar (opcional)" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label="Cancelar" style={{ flex: 1 }} onPress={onCancel} />
        <Button label="Crear" variant="primary" style={{ flex: 1 }} disabled={!name.trim() || pending} onPress={() => onSubmit(name.trim(), target.value || null)} />
      </View>
    </Card>
  );
}
