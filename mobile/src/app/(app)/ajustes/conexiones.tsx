import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, View } from "react-native";
import { api } from "@/core/api";
import { API_URL } from "@/core/config";
import { connectDevice, currentDeviceKeyId, lastConnectError } from "@/core/device";
import type { Me } from "@/core/types";
import { useAction } from "@/core/use-action";
import { ago, Section, ToggleRow, useSettings } from "@/features/settings/shared";
import { WastedAndroid } from "../../../../modules/wasted-android";
import { Button } from "@/ui/button";
import { Card, Divider } from "@/ui/card";
import { confirmAction } from "@/ui/confirm";
import { Notice } from "@/ui/fields";
import { ListRow, ListSection } from "@/ui/list";
import { Screen } from "@/ui/screen";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

/** Lo que conecta Wasted con lo de afuera: correo, Telegram, este celular, atajos (antes en Ajustes). */
export default function ConnectionsScreen() {
  const query = useSettings();
  const action = useAction();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("me"), staleTime: Infinity });
  const [token, setToken] = useState<string | null>(null);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [thisDevice, setThisDevice] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(lastConnectError);
  const data = query.data;

  useEffect(() => {
    currentDeviceKeyId().then(setThisDevice);
  }, [data?.devices]);

  /** Vuelve a pedir la clave de este celular (el widget, el registro rápido y las notificaciones la usan). */
  async function reconnect() {
    if (!me.data) return;
    setConnecting(true);
    const error = await connectDevice(me.data.userId);
    setConnectError(error);
    setThisDevice(await currentDeviceKeyId());
    await query.refetch();
    setConnecting(false);
  }

  async function connectTelegram() {
    setTelegramError(null);
    const result = await api<{ url?: string; error?: string }>("createTelegramLink").catch((e: Error) => ({ error: e.message, url: undefined }));
    if (result.url) Linking.openURL(result.url);
    else setTelegramError(result.error ?? "No pude abrir Telegram.");
  }

  async function createKey() {
    const result = await api<{ token?: string; error?: string }>("createApiToken");
    if (result.token) {
      setToken(result.token);
      query.refetch();
    }
  }

  return (
    <Screen title="Conexiones" loading={!data && !query.error} error={query.error?.message} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      {data && (
        <View style={{ gap: 32 }}>
          {action.notice && <Notice text={action.notice.text} error={action.notice.error} />}

          {WastedAndroid && (
            <ListSection title="Este celular" note="Lee los avisos de pagos de Nequi, Nu, DiDi, Uber y Yango, nunca chats ni otras apps.">
              {!thisDevice ? (
                <View style={{ padding: 16, gap: 12 }}>
                  <Text size={14}>
                    Este celular no está conectado: el widget, el registro rápido y los pagos automáticos no funcionan.
                    {connectError ? ` Motivo: ${connectError}` : ""}
                  </Text>
                  <Button label={connecting ? "Conectando…" : "Reintentar"} variant="primary" disabled={connecting || !me.data} onPress={reconnect} />
                </View>
              ) : null}
              <ListRow title="Pagos automáticos" subtitle="Registrar lo que avisan tus bancos" onPress={() => router.push("/notificaciones")} />
              <ListRow title="Registro rápido" subtitle="El cuadro “¿Qué registras?” sin abrir la app" onPress={() => WastedAndroid?.openQuickAdd()} />
            </ListSection>
          )}

          {data.mail && (
            <Section
              title="Correo"
              note={`Lee ${data.email}: avisos de Nequi, viajes de Uber y DiDi, pedidos de Rappi y facturas. Lo claro se registra solo y lo dudoso queda en Por revisar. ${data.mailSync?.last_synced_at ? `Última revisión: ${ago(data.mailSync.last_synced_at)}.` : "Aún no se ha revisado."}`}
            >
              <Card>
                <ToggleRow label="Importar del correo" value={data.mailSync?.enabled ?? true} onChange={(enabled) => action.run("setMailImport", { enabled })} />
              </Card>
              <Button label="Revisar correo ahora" onPress={() => action.run("syncMailNow")} />
            </Section>
          )}

          <Section title="Telegram" note="Escríbele al bot “25k almuerzo” para registrar sin abrir la app, y usa /semana o /mes para ver cómo vas. Los reportes y avisos de presupuesto también llegan ahí.">
            {data.telegram ? (
              <Card style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text>Conectado</Text>
                  {data.telegram.username && (
                    <Text size={14} tone="muted">
                      @{data.telegram.username}
                    </Text>
                  )}
                </View>
                <Tap
                  accessibilityRole="button"
                  onPress={() => confirmAction("¿Desconectar Telegram?", "El bot dejará de registrar tus mensajes.", "Desconectar", () => action.run("unlinkTelegram"))}
                  style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}
                >
                  <Text size={14} tone="danger">
                    Desconectar
                  </Text>
                </Tap>
              </Card>
            ) : (
              <Button label="Conectar Telegram" variant="primary" height={52} onPress={connectTelegram} />
            )}
            {telegramError && <Notice text={telegramError} error />}
          </Section>

          {data.devices.length > 0 && (
            <Section
              title="Celulares conectados"
              note="Cada celular con la app usa una clave propia para el widget, el registro rápido y las notificaciones. Se crea al entrar y se revoca al salir."
            >
              <Card>
                {data.devices.map((d, i) => (
                  <View key={d.id}>
                    {i > 0 && <Divider />}
                    <View style={{ minHeight: 56, paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1}>{d.device}</Text>
                        <Text size={14} tone="muted" numberOfLines={1}>
                          {d.id === thisDevice ? "Este celular" : d.last_used_at ? `Usado ${ago(d.last_used_at)}` : "Conectado, sin usar todavía"}
                        </Text>
                      </View>
                      {d.id !== thisDevice && (
                        <Tap
                          accessibilityRole="button"
                          accessibilityLabel={`Desconectar ${d.device}`}
                          onPress={() =>
                            confirmAction(
                              `¿Desconectar ${d.device}?`,
                              "Su widget y la lectura de notificaciones dejan de funcionar hasta que vuelvas a entrar en la app.",
                              "Desconectar",
                              () => action.run("revokeDeviceKey", { id: d.id }),
                            )
                          }
                          style={{ minHeight: 44, justifyContent: "center" }}
                        >
                          <Text size={14} tone="danger">
                            Desconectar
                          </Text>
                        </Tap>
                      )}
                    </View>
                  </View>
                ))}
              </Card>
            </Section>
          )}

          <Section
            title="Atajos y widgets"
            note={
              WastedAndroid
                ? "Para Atajos en iPhone y HTTP Shortcuts: un botón que pide “25k almuerzo” y un widget con lo que te queda. En este celular el widget y el registro rápido ya están conectados."
                : "Registra desde la pantalla de inicio sin abrir la app: un botón que pide “25k almuerzo”, botones fijos para lo de siempre y un widget con lo que te queda."
            }
          >
            {token ? (
              <Card style={{ padding: 12, gap: 8 }}>
                <Text size={14}>Tu clave (solo se muestra esta vez):</Text>
                <Text mono size={13} selectable>
                  {token}
                </Text>
                <Button label="Copiar" onPress={() => Clipboard.setStringAsync(token)} />
              </Card>
            ) : data.apiToken ? (
              <Card style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text>Clave activa</Text>
                  <Text size={14} tone="muted">
                    {data.apiToken.last_used_at ? `Usada ${ago(data.apiToken.last_used_at)}` : "Sin usar todavía"}
                  </Text>
                </View>
                <Tap
                  accessibilityRole="button"
                  onPress={() => confirmAction("¿Revocar la clave?", "Tus atajos dejarán de funcionar hasta que crees otra.", "Revocar", () => action.run("revokeApiToken"))}
                  style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}
                >
                  <Text size={14} tone="danger">
                    Revocar
                  </Text>
                </Tap>
              </Card>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                label={data.apiToken ? "Crear otra" : "Crear clave"}
                variant="primary"
                style={{ flex: 1 }}
                onPress={() =>
                  data.apiToken ? confirmAction("¿Crear otra clave?", "Los atajos con la clave anterior dejarán de funcionar.", "Crear otra", createKey) : createKey()
                }
              />
              <Button label="Ver la guía" style={{ flex: 1 }} onPress={() => Linking.openURL(`${API_URL}/ajustes/atajos`)} />
            </View>
          </Section>
        </View>
      )}
    </Screen>
  );
}
