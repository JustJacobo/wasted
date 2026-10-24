import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { canImportMail } from "@/lib/mail-import/sync";
import { parseAccent } from "@/lib/theme";
import { SyncButton } from "../bandeja/sync-button";
import { AccentPicker } from "./accent-picker";
import { MailToggle } from "./mail-toggle";
import { InviteForm } from "./invite-form";
import { ReportToggles } from "./report-toggles";
import { RemoveButton } from "./remove-button";
import { TelegramConnect } from "./telegram-connect";

const time = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

function lastSync(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  return time.format(new Date(iso));
}

export default async function SettingsPage() {
  const { supabase, email, name, role } = await requireUser();
  const mail = canImportMail(email);
  const [{ data: settings }, { data: telegram }, { data: mailSync }] = await Promise.all([
    supabase.from("user_settings").select("report_weekly, report_monthly, accent").maybeSingle(),
    supabase.from("telegram_links").select("username").maybeSingle(),
    mail
      ? supabase.from("mail_sync").select("enabled, since, last_synced_at").maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const members =
    role === "owner"
      ? ((
          await supabase.from("members").select("email, role, created_at").order("created_at")
        ).data ?? [])
      : [];

  return (
    <main className="mx-auto max-w-lg space-y-8 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-2 py-2">
        <Link href="/" className="rounded-lg px-2 py-1 text-sm text-muted active:scale-[0.97]">
          ← Volver
        </Link>
      </header>

      <section className="space-y-2">
        <h1 className="px-1 text-sm text-muted">Tu cuenta</h1>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-border">
          <span className="min-w-0">
            <span className="block truncate font-medium capitalize">{name}</span>
            <span className="block truncate text-sm text-muted">{email}</span>
          </span>
          <form action="/auth/signout" method="post">
            <button className="shrink-0 rounded-lg px-2 py-1 text-sm text-danger active:scale-[0.97]">
              Salir
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-sm text-muted">Tus finanzas</h2>
        <Link
          href="/ajustes/categorias"
          className="flex items-center justify-between rounded-2xl bg-surface px-4 py-4 ring-1 ring-border active:scale-[0.99]"
        >
          <span>Categorías</span>
          <span aria-hidden className="text-muted">
            ›
          </span>
        </Link>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-sm text-muted">Tema</h2>
        <AccentPicker initial={parseAccent(settings?.accent)} />
        <p className="px-1 text-xs text-muted">Solo cambia el color de acento. El resto sigue en papel y tinta.</p>
      </section>

      {mail && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm text-muted">Correo</h2>
          <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-border">
            <MailToggle enabled={mailSync?.enabled ?? true} />
          </div>
          <p className="px-1 text-xs text-muted">
            Lee {email}: avisos de Nequi, viajes de Uber, pedidos de Rappi y facturas. Lo claro se
            registra solo y lo dudoso queda en{" "}
            <Link href="/bandeja" className="underline">
              Por revisar
            </Link>
            . {mailSync?.last_synced_at ? `Última revisión: ${lastSync(mailSync.last_synced_at)}.` : "Aún no se ha revisado."}
          </p>
          <SyncButton />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="px-1 text-sm text-muted">Telegram</h2>
        <TelegramConnect linked={Boolean(telegram)} username={telegram?.username ?? null} />
        <p className="px-1 text-xs text-muted">
          Escríbele al bot “25k almuerzo” para registrar sin abrir la app, y usa /semana o /mes
          para ver cómo vas. Los reportes y avisos de presupuesto también llegan ahí.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-sm text-muted">Reportes</h2>
        <ReportToggles
          weekly={settings?.report_weekly ?? true}
          monthly={settings?.report_monthly ?? true}
        />
        <p className="px-1 text-xs text-muted">
          Llegan a {email}{telegram ? " y a Telegram" : ""}: el semanal los lunes y el mensual el
          día 1, a las 7:00 a. m.
        </p>
      </section>

      {role === "owner" && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm text-muted">Personas con acceso</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface ring-1 ring-border">
            {members.map((m) => (
              <li key={m.email} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 truncate">{m.email}</span>
                {m.role === "owner" ? (
                  <span className="shrink-0 text-xs text-muted">Dueño</span>
                ) : (
                  <RemoveButton email={m.email} />
                )}
              </li>
            ))}
          </ul>
          <InviteForm />
          <p className="px-1 text-xs text-muted">
            Cada persona ve solo sus propios movimientos. Comparte el enlace de la app y pídele que
            entre con Google usando el correo que agregaste.
          </p>
        </section>
      )}
    </main>
  );
}
