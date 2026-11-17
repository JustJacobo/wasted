import { DownloadSimple, PlugsConnected, Tag, Users } from "@phosphor-icons/react/dist/ssr";
import { cookies } from "next/headers";
import Link from "next/link";
import { ListRow, ListSection } from "@/components/list";
import { ScreenHeader } from "@/components/screen-header";
import { getSettings } from "@/lib/data";
import { ACCENT_COOKIE, MODE_COOKIE, parseAccent, parseMode } from "@/lib/theme";
import { ReportToggles } from "./report-toggles";
import { ThemePicker } from "./theme-picker";
import { lastSync } from "./time";

/**
 * Ajustes: solo configuración. Recurrentes, préstamos y metas están en el Plan;
 * Telegram, correo, la app de Android y atajos, en Conexiones.
 */
export default async function SettingsPage() {
  const { email, name, role, mail, settings, telegram, mailSync, devices, members } = await getSettings();
  // El tema que muestra Ajustes es el que pinta este dispositivo (cookies del layout).
  const jar = await cookies();
  const connections = [
    telegram ? "Telegram conectado" : "Telegram sin conectar",
    mail && (mailSync?.last_synced_at ? `Correo ${lastSync(mailSync.last_synced_at)}` : "Correo sin revisar"),
    devices.length > 0 && (devices.length === 1 ? "1 celular" : `${devices.length} celulares`),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="mx-auto max-w-lg space-y-7 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <ScreenHeader title="Ajustes" back="/" />

      <div className="flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 ring-1 ring-border">
        <span className="min-w-0">
          <span className="block truncate font-medium capitalize">{name}</span>
          <span className="block truncate text-sm text-muted">{email}</span>
        </span>
        <form action="/auth/signout" method="post">
          <button className="shrink-0 rounded-lg px-2 py-1 text-sm text-danger active:scale-[0.97]">Salir</button>
        </form>
      </div>

      <ListSection
        title="General"
        note="El CSV trae todos tus movimientos confirmados y se abre en Excel o Google Sheets. Para un solo mes, usa el botón CSV de Movimientos."
      >
        <ListRow href="/ajustes/categorias" icon={<Tag aria-hidden className="size-5" />} title="Categorías" />
        {/* Un archivo de un Route Handler, no una página: <Link> lo precargaría en cada visita. */}
        <ListRow
          href="/movimientos/exportar?todo=1"
          plain
          icon={<DownloadSimple aria-hidden className="size-5" />}
          title="Exportar a CSV"
          trailing={<span />}
        />
      </ListSection>

      <ListSection note="Registrar sin abrir la app: Telegram, el correo, los avisos de tus bancos, el widget y los atajos.">
        <ListRow href="/ajustes/conexiones" icon={<PlugsConnected aria-hidden className="size-5" />} title="Conexiones" subtitle={connections} />
      </ListSection>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-medium text-muted">Tema</h2>
        <ThemePicker
          initialAccent={parseAccent(jar.get(ACCENT_COOKIE)?.value ?? settings?.accent)}
          initialMode={parseMode(jar.get(MODE_COOKIE)?.value ?? settings?.color_mode)}
        />
        <p className="px-1 text-xs text-muted">El acento solo cambia los detalles de color. El resto sigue en papel y tinta.</p>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-medium text-muted">Reportes</h2>
        <ReportToggles weekly={settings?.report_weekly ?? true} monthly={settings?.report_monthly ?? true} />
        <p className="px-1 text-xs text-muted">
          Llegan a {email}
          {telegram ? " y a Telegram" : ""}: el semanal los lunes y el mensual el día 1, a las 7:00 a. m.
        </p>
      </section>

      {role === "owner" && (
        <ListSection>
          <ListRow
            href="/ajustes/personas"
            icon={<Users aria-hidden className="size-5" />}
            title="Personas con acceso"
            subtitle={members.length === 1 ? "Solo tú" : `${members.length} personas`}
          />
        </ListSection>
      )}

      <p className="text-center">
        <Link href="/privacidad" className="inline-block px-3 py-2 text-xs text-muted active:opacity-70">
          Privacidad
        </Link>
      </p>
    </main>
  );
}
