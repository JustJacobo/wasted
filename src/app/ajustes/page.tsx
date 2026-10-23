import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { InviteForm } from "./invite-form";
import { ReportToggles } from "./report-toggles";
import { RemoveButton } from "./remove-button";

export default async function SettingsPage() {
  const { supabase, email, name, role } = await requireUser();
  const { data: settings } = await supabase
    .from("user_settings")
    .select("report_weekly, report_monthly")
    .maybeSingle();
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
        <h2 className="px-1 text-sm text-muted">Reportes por correo</h2>
        <ReportToggles
          weekly={settings?.report_weekly ?? true}
          monthly={settings?.report_monthly ?? true}
        />
        <p className="px-1 text-xs text-muted">
          Llegan a {email}: el semanal los lunes y el mensual el día 1, a las 7:00 a. m.
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
