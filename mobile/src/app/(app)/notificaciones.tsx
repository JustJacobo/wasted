import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { AppState, Switch, View } from "react-native";
import { WastedAndroid } from "../../../modules/wasted-android";
import { api } from "@/core/api";
import { useTheme } from "@/theme/theme";
import { Button } from "@/ui/button";
import { Card, Divider } from "@/ui/card";
import { Notice } from "@/ui/fields";
import { Screen } from "@/ui/screen";
import { Text } from "@/ui/text";

/** Las apps cuyas notificaciones se leen (Packages.WATCHED en Java, WATCHED_PACKAGES en el servidor). */
const WATCHED: Record<string, string> = {
  "com.nequi.MobileApp": "Nequi",
  "com.nu.production": "Nu",
  "com.didiglobal.passenger": "DiDi",
  "com.sdu.didi.psnger": "DiDi",
  "com.ubercab": "Uber",
  "com.yandex.yango": "Yango",
};
const APPS = [...new Set(Object.values(WATCHED))];

const OUTCOMES: Record<string, string> = {
  recorded: "Registrada",
  pending: "Por revisar",
  duplicate: "Ya estaba",
  own_transfer: "Entre tus cuentas",
  ignored: "Sin movimiento",
};

interface LogEntry {
  package: string;
  title: string;
  text: string;
  outcome: string;
  processed_at: string;
}

const time = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function readStatus() {
  return {
    granted: WastedAndroid?.hasNotificationAccess() ?? false,
    reading: WastedAndroid?.readNotifications() ?? false,
    installed: new Set(WastedAndroid?.installedPayApps() ?? []),
  };
}

/**
 * Pagos automáticos: el permiso de Android para leer las notificaciones de las
 * apps de pagos y lo último que llegó. Se abre desde Ajustes, el acceso directo
 * del ícono y wasted://notificaciones (Ajustes de la web).
 */
export default function NotificationsScreen() {
  const { colors } = useTheme();
  const [status, setStatus] = useState(readStatus);
  const log = useQuery({ queryKey: ["settings"], queryFn: () => api<{ notifications: LogEntry[] }>("settings") });
  const refresh = useCallback(() => setStatus(readStatus()), []);

  // El permiso se da en la pantalla de Android: al volver se lee de nuevo.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => state === "active" && refresh());
    return () => sub.remove();
  }, [refresh]);

  if (!WastedAndroid) {
    return (
      <Screen title="Pagos automáticos">
        <Text tone="muted">Esto solo funciona en la app de Android.</Text>
      </Screen>
    );
  }

  return (
    <Screen title="Pagos automáticos" refreshing={log.isRefetching} onRefresh={() => {
        refresh();
        void log.refetch();
      }}>
      <View style={{ gap: 24 }}>
        <Text tone="muted">
          Wasted lee solo los avisos de pagos de estas apps, nunca chats ni otras apps. Lo claro se registra solo, lo dudoso queda en Por revisar y lo que pasas entre tus cuentas no cuenta.
        </Text>

        <Card>
          {APPS.map((app, i) => (
            <View key={app}>
              {i > 0 && <Divider />}
              <View style={{ minHeight: 48, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text>{app}</Text>
                <Text size={14} tone="muted">
                  {status.installed.has(app) ? "Instalada" : "No está instalada"}
                </Text>
              </View>
            </View>
          ))}
        </Card>

        {status.granted ? (
          <View style={{ gap: 8 }}>
            <Card>
              <View style={{ minHeight: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ flex: 1 }}>Registrar pagos de las notificaciones</Text>
                <Switch
                  accessibilityLabel="Registrar pagos de las notificaciones"
                  value={status.reading}
                  onValueChange={(read) => {
                    WastedAndroid?.setReadNotifications(read);
                    refresh();
                  }}
                  trackColor={{ true: colors.foreground, false: colors.border }}
                  thumbColor={colors.surface}
                />
              </View>
            </Card>
            <Text size={12} tone="muted" style={{ paddingHorizontal: 4 }}>
              {status.reading ? "Activo. Los próximos pagos se registran solos." : "En pausa: las notificaciones no se leen."}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Notice text="Falta el permiso: toca el botón y activa Wasted." />
            <Button label="Dar acceso a las notificaciones" variant="primary" height={52} onPress={() => WastedAndroid?.openNotificationSettings()} />
            <Text size={12} tone="muted" style={{ paddingHorizontal: 4 }}>
              Si Android dice “Ajuste restringido”: abre la información de la app, toca ⋮ (arriba a la derecha) → “Permitir ajustes restringidos” y vuelve a dar el acceso.
            </Text>
            <Button label="Abrir información de la app" onPress={() => WastedAndroid?.openAppDetails()} />
          </View>
        )}

        {log.data && log.data.notifications.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text size={14} tone="muted" style={{ paddingHorizontal: 4 }} accessibilityRole="header">
              Últimas leídas
            </Text>
            <Card>
              {log.data.notifications.map((entry, i) => (
                <View key={i}>
                  {i > 0 && <Divider />}
                  <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                      <Text size={14} weight="medium" numberOfLines={1} style={{ flex: 1 }}>
                        {WATCHED[entry.package] ?? entry.package}
                      </Text>
                      <Text size={12} tone="muted">
                        {OUTCOMES[entry.outcome] ?? entry.outcome} · {time.format(new Date(entry.processed_at))}
                      </Text>
                    </View>
                    <Text size={12} tone="muted" numberOfLines={2}>
                      {[entry.title, entry.text].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        )}
      </View>
    </Screen>
  );
}
