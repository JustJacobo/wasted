import Link from "next/link";
import { LoginForm } from "./login-form";

const ERRORS: Record<string, string> = {
  login: "No se pudo iniciar sesión. Intenta de nuevo.",
  no_autorizado:
    "Esta cuenta todavía no tiene acceso. Pídele a quien te compartió Wasted que agregue tu correo.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6 pb-[env(safe-area-inset-bottom)]">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Wasted</h1>
        <p className="text-muted">Tus gastos e ingresos en segundos.</p>
      </div>
      {message && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {message}
        </p>
      )}
      <LoginForm />
      <Link href="/privacidad" className="text-center text-xs text-muted">
        Política de privacidad
      </Link>
    </main>
  );
}
