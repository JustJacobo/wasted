import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacidad · Wasted" };

// Página pública (la exige Google para publicar el login con Google).
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-lg space-y-5 px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-12 leading-relaxed">
      <Link href="/" className="text-sm text-muted">
        ← Wasted
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Política de privacidad</h1>
      <p className="text-sm text-muted">Última actualización: 23 de octubre de 2026</p>

      <p>
        Wasted es una app personal para registrar gastos e ingresos. Solo pueden usarla personas
        invitadas por su administrador.
      </p>

      <h2 className="font-semibold">Qué datos guardamos</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Tu nombre y correo electrónico, que nos entrega Google o el enlace de acceso.</li>
        <li>Los movimientos que registras: monto, descripción, categoría y fecha.</li>
        <li>Las correcciones de categoría que haces, para sugerirlas la próxima vez.</li>
      </ul>

      <h2 className="font-semibold">Cómo los usamos</h2>
      <p>
        Solo para mostrarte tus propias finanzas. Cada persona ve únicamente sus movimientos. No
        vendemos ni compartimos tus datos con fines publicitarios.
      </p>

      <h2 className="font-semibold">Con quién se procesan</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Supabase (base de datos y autenticación), con servidores en São Paulo, Brasil.</li>
        <li>Vercel, que aloja la aplicación.</li>
        <li>
          Anthropic (Claude): cuando una descripción no coincide con ninguna categoría conocida, se
          envía solo ese texto para sugerir la categoría.
        </li>
      </ul>

      <h2 className="font-semibold">Tus derechos</h2>
      <p>
        Puedes editar o borrar cualquier movimiento desde la app. Para eliminar tu cuenta y todos
        tus datos, escribe a{" "}
        <a className="underline" href="mailto:jacobogiraldorios@gmail.com">
          jacobogiraldorios@gmail.com
        </a>
        .
      </p>
    </main>
  );
}
