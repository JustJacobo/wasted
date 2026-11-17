import { useQuery } from "@tanstack/react-query";
import { Switch, View } from "react-native";
import { api } from "@/core/api";
import { useTheme } from "@/theme/theme";
import { Text } from "@/ui/text";

/** Lo que trae la op `settings` (getSettings en src/lib/data.ts). */
export interface SettingsData {
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

/** Ajustes, Conexiones y Personas leen lo mismo: una sola consulta. */
export const useSettings = () => useQuery({ queryKey: ["settings"], queryFn: () => api<SettingsData>("settings") });

const time = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** "hace un momento", "hace 5 min" o la fecha y la hora. */
export function ago(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  return time.format(new Date(iso));
}

/** Un grupo con título y nota, para lo que no es una lista de filas (botones, campos). */
export function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text size={14} weight="medium" tone="muted" style={{ paddingHorizontal: 4 }} accessibilityRole="header">
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

/** Un interruptor de fila completa. */
export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ minHeight: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ flex: 1 }}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: colors.foreground, false: colors.border }} thumbColor={colors.surface} />
    </View>
  );
}
