import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Fragment, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Category } from "@/lib/types";
import { api } from "@/core/api";
import { refreshAfterWrite } from "@/core/query";
import { cards, type PendingItem } from "@/features/inbox/cards";
import { PendingPair, PendingRow } from "@/features/inbox/cards-ui";
import { useTheme } from "@/theme/theme";
import { Button } from "@/ui/button";
import { Card, Divider } from "@/ui/card";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

interface PendingData {
  today: string;
  pending: PendingItem[];
  categories: Category[];
  fromMail: boolean;
}

/** Por revisar: lo que llegó del correo o de notificaciones y los recurrentes vencidos (bandeja/page.tsx). */
export default function InboxScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const query = useQuery({ queryKey: ["pending"], queryFn: () => api<PendingData>("pending") });
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function syncNow() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await api<{ message: string }>("syncMailNow");
      setSyncMessage(result.message);
      refreshAfterWrite();
    } catch (e) {
      setSyncMessage(e instanceof Error ? e.message : "No pude revisar el correo.");
    } finally {
      setSyncing(false);
    }
  }

  const data = query.data;
  const pending = data?.pending ?? [];
  const recurring = pending.some((p) => p.recurring_id);
  const imported = pending.some((p) => !p.recurring_id);
  const origin = pending.some((p) => p.source === "notification")
    ? pending.some((p) => p.source.startsWith("email_"))
      ? "del correo y de notificaciones"
      : "de notificaciones"
    : "del correo";

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, gap: 16 }}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.foreground} />}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Tap accessibilityRole="button" onPress={() => router.back()} style={{ paddingVertical: 8, paddingRight: 12 }}>
          <Text size={14} tone="muted">
            ← Volver
          </Text>
        </Tap>
        <Text size={18} weight="bold" align="right" style={{ flex: 1 }} accessibilityRole="header">
          Por revisar
        </Text>
      </View>

      {!data ? (
        <View style={{ paddingTop: 48, alignItems: "center" }}>
          {query.error ? <Text>{query.error.message}</Text> : <ActivityIndicator color={colors.foreground} />}
        </View>
      ) : pending.length === 0 ? (
        <Card style={{ paddingVertical: 40, paddingHorizontal: 20 }}>
          <Text size={14} tone="muted" align="center">
            Nada por revisar.{data.fromMail && " Lo que llega claro del correo se registra solo."}
          </Text>
        </Card>
      ) : (
        <>
          <Text size={14} tone="muted">
            {recurring && imported
              ? `Recurrentes que vencieron y movimientos ${origin} que no son seguros o se parecen a algo que ya registraste.`
              : recurring
                ? "Recurrentes que vencieron. Cuentan en tu saldo cuando los agregas."
                : `Llegaron ${origin}, pero no son seguros o se parecen a algo que ya registraste.`}
          </Text>
          <Card>
            {cards(pending).map((card, i) => (
              <Fragment key={card.kind === "pair" ? `${card.recurring.id}:${card.mail.id}` : card.item.id}>
                {i > 0 && <Divider />}
                {card.kind === "pair" ? (
                  <PendingPair recurring={card.recurring} mail={card.mail} categories={data.categories} today={data.today} />
                ) : (
                  <PendingRow item={card.item} categories={data.categories} today={data.today} />
                )}
              </Fragment>
            ))}
          </Card>
        </>
      )}

      {data?.fromMail && (
        <View style={{ gap: 8 }}>
          <Button label={syncing ? "Revisando…" : "Revisar correo ahora"} disabled={syncing} onPress={syncNow} />
          {syncMessage && (
            <Text size={14} tone="muted" align="center" accessibilityLiveRegion="polite">
              {syncMessage}
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}
