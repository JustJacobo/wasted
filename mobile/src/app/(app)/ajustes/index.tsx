import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Switch, View } from "react-native";
import { ACCENTS, COLOR_MODES } from "@/lib/theme";
import { api } from "@/core/api";
import { WastedAndroid } from "../../../../modules/wasted-android";
import { signOut } from "@/core/auth";
import { API_URL } from "@/core/config";
import { currentDeviceKeyId } from "@/core/device";
import { shareCsv } from "@/core/share-csv";
import { useAction } from "@/core/use-action";
import { useTheme } from "@/theme/theme";
import { Button } from "@/ui/button";
import { Card, Divider } from "@/ui/card";
import { confirmAction } from "@/ui/confirm";
import { Field, Notice } from "@/ui/fields";
import { Screen } from "@/ui/screen";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

interface SettingsData {
  email: string;
  name: string;
  role: "owner" | "member";
  mail: boolean;
  settings: { report_weekly: boolean; report_monthly: boolean; accent: string | null; color_mode: string | null } | null;
  telegram: { username: string | null } | null;
  mailSync: { enabled: boolean; since: string; last_synced_at: string | null } | null;
  apiToken: { last_used_at: string | null } | null;
  devices: { id: string; device: string; last_used_at: string | null }[];
  notifications: { package: string; title: string; text: string; outcome: string; processed_at: string }[];
  members: { email: string; role: string; created_at: string }[];
}

const time = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
function ago(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  return time.format(new Date(iso));
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text size={14} tone="muted" style={{ paddingHorizontal: 4 }} accessibilityRole="header">
        {title}
      </Text>
      {children}
      {note && (
        <Text size={12} tone="muted" style={{ paddingHorizontal: 4 }}>
          {note}
        </Text>
      )}
    </View>
  );
}

function LinkRow({ label, onPress, trailing = "›" }: { label: string; onPress: () => void; trailing?: string }) {
  return (
    <Tap accessibilityRole="button" pressScale={0.99} onPress={onPress}>
      <Card style={{ minHeight: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text>{label}</Text>
        <Text tone="muted">{trailing}</Text>
      </Card>
    </Tap>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ minHeight: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: colors.foreground, false: colors.border }} thumbColor={colors.surface} />
    </View>
  );
}

/** Ajustes (src/app/ajustes/page.tsx). */
export default function SettingsScreen() {
  const { colors, scheme, accent, mode, setAppearance } = useTheme();
  const query = useQuery({ queryKey: ["settings"], queryFn: () => api<SettingsData>("settings") });
  const action = useAction();
  const [token, setToken] = useState<string | null>(null);
  const [invite, setInvite] = useState("");
  const [exporting, setExporting] = useState(false);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [thisDevice, setThisDevice] = useState<string | null>(null);
  const data = query.data;

  useEffect(() => {
    currentDeviceKeyId().then(setThisDevice);
  }, [data?.devices]);
  const go = (href: Href) => router.push(href);

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
    <Screen title="Ajustes" loading={!data && !query.error} error={query.error?.message} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      {data && (
        <View style={{ gap: 32 }}>
          {action.notice && <Notice text={action.notice.text} error={action.notice.error} />}

          <Section title="Tu cuenta">
            <Card style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight="medium" numberOfLines={1} style={{ textTransform: "capitalize" }}>
                  {data.name}
                </Text>
                <Text size={14} tone="muted" numberOfLines={1}>
                  {data.email}
                </Text>
              </View>
              <Tap accessibilityRole="button" onPress={() => signOut()} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}>
                <Text size={14} tone="danger">
                  Salir
                </Text>
              </Tap>
            </Card>
          </Section>

          <Section title="Tus finanzas" note="El CSV trae todos tus movimientos confirmados y se abre en Excel o Google Sheets. Para un solo mes, usa el botón CSV del Historial.">
            <LinkRow label="Categorías" onPress={() => go("/ajustes/categorias")} />
            <LinkRow label="Recurrentes" onPress={() => go("/ajustes/recurrentes")} />
            <LinkRow label="Préstamos" onPress={() => go("/prestamos")} />
            <LinkRow label="Metas" onPress={() => go("/metas")} />
            <LinkRow
              label={exporting ? "Exportando…" : "Exportar a CSV"}
              trailing="↓"
              onPress={async () => {
                setExporting(true);
                await shareCsv({ todo: true }).catch(() => {});
                setExporting(false);
              }}
            />
          </Section>

          <Section title="Tema" note="El acento solo cambia los detalles de color. El resto sigue en papel y tinta.">
            <Card style={{ padding: 12, gap: 16 }}>
              <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                {COLOR_MODES.map((m) => (
                  <Tap
                    key={m.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: mode === m.key }}
                    onPress={() => {
                      setAppearance({ mode: m.key });
                      api("setColorMode", { mode: m.key }).catch(() => {});
                    }}
                    style={{ flex: 1, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: mode === m.key ? colors.foreground : "transparent" }}
                  >
                    <Text size={14} weight="medium" style={{ color: mode === m.key ? colors.background : colors.muted }}>
                      {m.name}
                    </Text>
                  </Tap>
                ))}
              </View>
              <View accessibilityRole="radiogroup" style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {ACCENTS.map((a) => (
                  <Tap
                    key={a.key}
                    accessibilityRole="radio"
                    accessibilityLabel={a.name}
                    accessibilityState={{ selected: accent === a.key }}
                    onPress={() => {
                      setAppearance({ accent: a.key });
                      api("setAccent", { accent: a.key }).catch(() => {});
                    }}
                    style={{ alignItems: "center", gap: 6 }}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: scheme === "dark" ? a.swatch.dark : a.swatch.light, borderWidth: accent === a.key ? 3 : 1, borderColor: accent === a.key ? colors.foreground : colors.border }} />
                    <Text size={12}>{a.name}</Text>
                  </Tap>
                ))}
              </View>
            </Card>
          </Section>

          {data.mail && (
            <Section
              title="Correo"
              note={`Lee ${data.email}: avisos de Nequi, viajes de Uber, pedidos de Rappi y facturas. Lo claro se registra solo y lo dudoso queda en Por revisar. ${data.mailSync?.last_synced_at ? `Última revisión: ${ago(data.mailSync.last_synced_at)}.` : "Aún no se ha revisado."}`}
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
                  onPress={() => confirmAction("¿Desconectar Telegram?", "El bot dejará de registrar tus mensajes.", "Desconectar", () => action.run("unlinkTelegram"))} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}>
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

          {WastedAndroid && (
            <Section title="Este celular" note="Lee los avisos de pagos de Nequi, Nu, DiDi, Uber y Yango, nunca chats ni otras apps.">
              <LinkRow label="Pagos automáticos" onPress={() => go("/notificaciones")} />
              <LinkRow label="Registro rápido" onPress={() => WastedAndroid?.openQuickAdd()} />
            </Section>
          )}

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
                  onPress={() => confirmAction("¿Revocar la clave?", "Tus atajos dejarán de funcionar hasta que crees otra.", "Revocar", () => action.run("revokeApiToken"))} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}>
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
                  data.apiToken
                    ? confirmAction("¿Crear otra clave?", "Los atajos con la clave anterior dejarán de funcionar.", "Crear otra", createKey)
                    : createKey()
                }
              />
              <Button label="Ver la guía" style={{ flex: 1 }} onPress={() => Linking.openURL(`${API_URL}/ajustes/atajos`)} />
            </View>
          </Section>

          <Section title="Reportes" note={`Llegan a ${data.email}${data.telegram ? " y a Telegram" : ""}: el semanal los lunes y el mensual el día 1, a las 7:00 a. m.`}>
            <Card>
              <ToggleRow label="Reporte semanal" value={data.settings?.report_weekly ?? true} onChange={(enabled) => action.run("setReportPreference", { field: "report_weekly", enabled })} />
              <Divider />
              <ToggleRow label="Reporte mensual" value={data.settings?.report_monthly ?? true} onChange={(enabled) => action.run("setReportPreference", { field: "report_monthly", enabled })} />
            </Card>
          </Section>

          {data.role === "owner" && (
            <Section title="Personas con acceso" note="Cada persona ve solo sus propios movimientos. Comparte la app y pídele que entre con el correo que agregaste.">
              <Card>
                {data.members.map((m, i) => (
                  <View key={m.email}>
                    {i > 0 && <Divider />}
                    <View style={{ minHeight: 48, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Text numberOfLines={1} style={{ flex: 1 }}>
                        {m.email}
                      </Text>
                      {m.role === "owner" ? (
                        <Text size={12} tone="muted">
                          Dueño
                        </Text>
                      ) : (
                        <Tap accessibilityRole="button" accessibilityLabel={`Quitar a ${m.email}`} onPress={() => confirmAction(`¿Quitar el acceso de ${m.email}?`, "Sus datos no se borran.", "Quitar", () => action.run("removeMember", { email: m.email }))} style={{ minHeight: 44, justifyContent: "center" }}>
                          <Text size={14} tone="danger">
                            Quitar
                          </Text>
                        </Tap>
                      )}
                    </View>
                  </View>
                ))}
              </Card>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Field value={invite} onChangeText={setInvite} placeholder="correo@ejemplo.com" keyboardType="email-address" autoCapitalize="none" accessibilityLabel="Correo a invitar" style={{ flex: 1 }} />
                <Button label="Invitar" variant="primary" height={48} disabled={!invite.includes("@") || action.pending} onPress={() => action.run("inviteMember", { email: invite }, () => setInvite(""))} />
              </View>
            </Section>
          )}

          <Tap accessibilityRole="link" onPress={() => Linking.openURL(`${API_URL}/privacidad`)} style={{ alignSelf: "center", paddingVertical: 12 }}>
            <Text size={12} tone="muted">
              Privacidad
            </Text>
          </Tap>
        </View>
      )}
    </Screen>
  );
}
