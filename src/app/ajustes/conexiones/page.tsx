import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ListRow, ListSection } from "@/components/list";
import { ScreenHeader } from "@/components/screen-header";
import { getSettings } from "@/lib/data";
import { SyncButton } from "../../bandeja/sync-button";
import { DeviceButton } from "../device-button";
import { MailToggle } from "../mail-toggle";
import { NotificationLog } from "../notification-log";
import { ShortcutsKey } from "../shortcuts-key";
import { TelegramConnect } from "../telegram-connect";
import { lastSync } from "../time";

/** Último APK publicado por el workflow de GitHub Releases (.github/workflows/android-release.yml). */
const APK_URL = "https://github.com/JustJacobo/wasted/releases/latest/download/wasted.apk";

/** Lo que conecta Wasted con lo de afuera: correo, Telegram, la app de Android, atajos (antes en Ajustes). */
export default async function ConnectionsPage() {
  const { email, mail, telegram, mailSync, apiToken, devices, notifications } = await getSettings();

  return (
    <main className="mx-auto max-w-lg space-y-8 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <ScreenHeader title="Conexiones" back="/ajustes" />

      {mail && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-medium text-muted">Correo</h2>
          <div className="overflow-hidden rounded-xl bg-surface ring-1 ring-border">
            <MailToggle enabled={mailSync?.enabled ?? true} />
          </div>
          <p className="px-1 text-xs text-muted">
            Lee {email}: avisos de Nequi, viajes de Uber y DiDi, pedidos de Rappi y facturas. Lo claro se registra solo y
            lo dudoso queda en{" "}
            <Link href="/bandeja" className="underline">
              Por revisar
            </Link>
            . {mailSync?.last_synced_at ? `Última revisión: ${lastSync(mailSync.last_synced_at)}.` : "Aún no se ha revisado."}
          </p>
          <SyncButton />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-medium text-muted">Telegram</h2>
        <TelegramConnect linked={Boolean(telegram)} username={telegram?.username ?? null} />
        <p className="px-1 text-xs text-muted">
          Escríbele al bot “25k almuerzo” para registrar sin abrir la app, y usa /semana o /mes para ver cómo vas. Los
          reportes y avisos de presupuesto también llegan ahí.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-medium text-muted">App de Android</h2>
        <div className="overflow-hidden rounded-xl bg-surface ring-1 ring-border">
          <ListRow href={APK_URL} plain title="Descargar la app (APK)" trailing={<DownloadSimple aria-hidden className="size-4 shrink-0 text-muted" />} />
        </div>
        {devices.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface ring-1 ring-border">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate">{d.device}</span>
                  <span className="block truncate text-sm text-muted">
                    {d.last_used_at ? `Usado ${lastSync(d.last_used_at)}` : "Conectado, sin usar todavía"}
                  </span>
                </span>
                <DeviceButton id={d.id} device={d.device ?? "el celular"} />
              </li>
            ))}
          </ul>
        )}
        <p className="px-1 text-xs text-muted">
          Ábrela desde las descargas y permite instalar apps de Chrome si Android lo pide. Trae un widget con lo que te
          queda y un botón para registrar sin abrir la app. Cada celular se conecta solo al entrar y aparece aquí.
        </p>
      </section>

      <ListSection
        title="Notificaciones del teléfono"
        note="La app de Android lee los avisos de pagos de Nequi, Nu, DiDi, Uber y Yango, nunca chats ni otras apps. Lo claro se registra solo, lo dudoso queda en Por revisar y lo que pasas entre tus cuentas no cuenta. Un mismo pago que llega por la tarjeta y por el correo queda una sola vez."
      >
        <ListRow href="wasted://notificaciones" plain title="Configurar en la app de Android" />
      </ListSection>
      {notifications && notifications.length > 0 && <NotificationLog entries={notifications} when={lastSync} />}

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-medium text-muted">Atajos y widgets</h2>
        <ShortcutsKey active={Boolean(apiToken)} lastUsed={apiToken?.last_used_at ? lastSync(apiToken.last_used_at) : null} />
        <p className="px-1 text-xs text-muted">
          Registra desde la pantalla de inicio sin abrir la app: un botón que pide “25k almuerzo”, botones fijos para lo
          de siempre y un widget con lo que te queda. Funciona con Atajos en iPhone y HTTP Shortcuts en Android.
        </p>
      </section>
    </main>
  );
}
