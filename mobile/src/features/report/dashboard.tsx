import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import type { PeriodKind, Report } from "@/lib/report";
import { api } from "@/core/api";
import { useTheme } from "@/theme/theme";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Text } from "@/ui/text";
import { CategoryBars, CategoryDonut, DailyChart, PeriodNav, StatTiles } from "./parts";

type SendResult = { ok: true; to: string } | { ok: false; error: string };

/** El dashboard: periodo, cifras y gráficos (src/app/reportes/report-view.tsx). */
export function Dashboard({ today, bottomInset, onCategory }: { today: string; bottomInset: number; onCategory?: (id: string, month: string) => void }) {
  const { colors } = useTheme();
  const [period, setPeriod] = useState<{ kind: PeriodKind; anchor: string }>({ kind: "semana", anchor: today });
  const report = useQuery({
    queryKey: ["report", period.kind, period.anchor],
    queryFn: () => api<Report>("report", period),
    placeholderData: (previous) => previous,
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<SendResult | null>(null);

  const kind = period.kind;
  const periodName = kind === "semana" ? "la semana anterior" : "el mes anterior";
  const data = report.data;

  async function send() {
    if (!data) return;
    setSending(true);
    setSent(null);
    try {
      setSent(await api<SendResult>("sendReportNow", { kind, anchor: data.range.start }));
    } catch (e) {
      setSent({ ok: false, error: e instanceof Error ? e.message : "No pude enviarlo." });
    } finally {
      setSending(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: bottomInset, gap: 16 }}
      refreshControl={<RefreshControl refreshing={report.isRefetching} onRefresh={() => void report.refetch()} tintColor={colors.foreground} />}
    >
      {!data ? (
        <View style={{ paddingTop: 48, alignItems: "center" }}>
          {report.error ? <Text>{report.error.message}</Text> : <ActivityIndicator color={colors.foreground} />}
        </View>
      ) : (
        <>
          <PeriodNav
            kind={kind}
            range={data.range}
            today={today}
            onChange={(k, anchor) => {
              setSent(null);
              setPeriod({ kind: k, anchor });
            }}
          />
          {data.expense === 0 && data.income === 0 ? (
            <Card style={{ paddingVertical: 40, paddingHorizontal: 20 }}>
              <Text size={14} tone="muted" align="center">
                No hay movimientos en este periodo.
              </Text>
            </Card>
          ) : (
            <>
              <StatTiles report={data} periodName={periodName} />
              <DailyChart key={`${kind}-${data.range.start}`} kind={kind} days={data.days} dailyAverage={data.dailyAverage} today={today} />
              {data.byCategory.length > 1 && <CategoryDonut key={`dona-${kind}-${data.range.start}`} slices={data.byCategory} />}
              {data.byCategory.length > 0 && (
                <CategoryBars slices={data.byCategory} periodName={periodName} onCategory={onCategory && ((id) => onCategory(id, data.range.start.slice(0, 7)))} />
              )}
              <Button label={sending ? "Enviando…" : "✉️  Enviarme este reporte"} height={48} disabled={sending} onPress={send} />
              {sent && (
                <Text size={14} align="center" tone={sent.ok ? "muted" : "danger"} accessibilityLiveRegion="polite">
                  {sent.ok ? `Reporte enviado a ${sent.to}.` : sent.error}
                </Text>
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}
