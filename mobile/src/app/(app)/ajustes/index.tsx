import Constants from "expo-constants";
import { router } from "expo-router";
import { DownloadSimpleIcon, PlugsConnectedIcon, TagIcon, UsersIcon } from "phosphor-react-native";
import { useState } from "react";
import { Linking, View } from "react-native";
import { ACCENTS, COLOR_MODES } from "@/lib/theme";
import { api } from "@/core/api";
import { signOut } from "@/core/auth";
import { API_URL } from "@/core/config";
import { shareCsv } from "@/core/share-csv";
import { useAction } from "@/core/use-action";
import { ago, Section, ToggleRow, useSettings, type SettingsData } from "@/features/settings/shared";
import { useTheme } from "@/theme/theme";
import { Card, Divider } from "@/ui/card";
import { Notice } from "@/ui/fields";
import { ListRow, ListSection } from "@/ui/list";
import { Screen } from "@/ui/screen";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

/** Una línea con el estado de las conexiones: "Telegram conectado · Correo hace 5 min". */
function connectionsSummary(data: SettingsData): string {
  const parts = [data.telegram ? "Telegram conectado" : "Telegram sin conectar"];
  if (data.mail) parts.push(data.mailSync?.last_synced_at ? `Correo ${ago(data.mailSync.last_synced_at)}` : "Correo sin revisar");
  if (data.devices.length > 0) parts.push(data.devices.length === 1 ? "1 celular" : `${data.devices.length} celulares`);
  return parts.join(" · ");
}

/**
 * Ajustes: solo configuración. Recurrentes, préstamos y metas están en el Plan;
 * Telegram, correo, este celular y atajos, en Conexiones (src/app/ajustes/page.tsx).
 */
export default function SettingsScreen() {
  const { colors, scheme, accent, mode, setAppearance } = useTheme();
  const query = useSettings();
  const action = useAction();
  const [exporting, setExporting] = useState(false);
  const data = query.data;

  return (
    <Screen title="Ajustes" loading={!data && !query.error} error={query.error?.message} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      {data && (
        <View style={{ gap: 28 }}>
          {action.notice && <Notice text={action.notice.text} error={action.notice.error} />}

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

          <ListSection title="General" note="El CSV trae todos tus movimientos confirmados y se abre en Excel o Google Sheets. Para un solo mes, usa el botón CSV de Movimientos.">
            <ListRow icon={<TagIcon size={20} color={colors.muted} />} title="Categorías" onPress={() => router.push("/ajustes/categorias")} />
            <ListRow
              icon={<DownloadSimpleIcon size={20} color={colors.muted} />}
              title={exporting ? "Exportando…" : "Exportar a CSV"}
              chevron={false}
              onPress={async () => {
                setExporting(true);
                await shareCsv({ todo: true }).catch(() => {});
                setExporting(false);
              }}
            />
          </ListSection>

          <ListSection note="Registrar sin abrir la app: Telegram, el correo, los avisos de tus bancos, el widget y los atajos.">
            <ListRow
              icon={<PlugsConnectedIcon size={20} color={colors.muted} />}
              title="Conexiones"
              subtitle={connectionsSummary(data)}
              onPress={() => router.push("/ajustes/conexiones")}
            />
          </ListSection>

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

          <Section title="Reportes" note={`Llegan a ${data.email}${data.telegram ? " y a Telegram" : ""}: el semanal los lunes y el mensual el día 1, a las 7:00 a. m.`}>
            <Card>
              <ToggleRow label="Reporte semanal" value={data.settings?.report_weekly ?? true} onChange={(enabled) => action.run("setReportPreference", { field: "report_weekly", enabled })} />
              <Divider />
              <ToggleRow label="Reporte mensual" value={data.settings?.report_monthly ?? true} onChange={(enabled) => action.run("setReportPreference", { field: "report_monthly", enabled })} />
            </Card>
          </Section>

          {data.role === "owner" && (
            <ListSection>
              <ListRow
                icon={<UsersIcon size={20} color={colors.muted} />}
                title="Personas con acceso"
                subtitle={data.members.length === 1 ? "Solo tú" : `${data.members.length} personas`}
                onPress={() => router.push("/ajustes/personas")}
              />
            </ListSection>
          )}

          <View style={{ alignItems: "center", gap: 4, paddingVertical: 8 }}>
            <Tap accessibilityRole="link" onPress={() => Linking.openURL(`${API_URL}/privacidad`)} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
              <Text size={12} tone="muted">
                Privacidad
              </Text>
            </Tap>
            {Constants.expoConfig?.version && (
              <Text size={12} tone="muted">
                Wasted {Constants.expoConfig.version}
              </Text>
            )}
          </View>
        </View>
      )}
    </Screen>
  );
}
