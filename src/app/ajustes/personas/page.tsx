import { ScreenHeader } from "@/components/screen-header";
import { getSettings } from "@/lib/data";
import { InviteForm } from "../invite-form";
import { RemoveButton } from "../remove-button";

/** Quién puede entrar a Wasted (solo el dueño invita y quita; antes en Ajustes). */
export default async function PeoplePage() {
  const { role, members } = await getSettings();

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <ScreenHeader title="Personas con acceso" back="/ajustes" />
      {role !== "owner" ? (
        <p className="px-1 text-sm text-muted">Solo el dueño de la cuenta puede invitar o quitar personas.</p>
      ) : (
        <section className="space-y-2">
          <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface ring-1 ring-border">
            {members.map((m) => (
              <li key={m.email} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 truncate">{m.email}</span>
                {m.role === "owner" ? <span className="shrink-0 text-xs text-muted">Dueño</span> : <RemoveButton email={m.email} />}
              </li>
            ))}
          </ul>
          <InviteForm />
          <p className="px-1 text-xs text-muted">
            Cada persona ve solo sus propios movimientos. Comparte el enlace de la app y pídele que entre con Google usando
            el correo que agregaste.
          </p>
        </section>
      )}
    </main>
  );
}
