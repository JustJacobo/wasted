"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { createApiToken, revokeApiToken } from "./actions";
import { CopyField } from "./copy-field";

const noSubscribe = () => () => {};
const isAndroid = () => /android/i.test(navigator.userAgent);

/**
 * Clave de atajos y widgets. Se muestra una sola vez al crearla; después solo
 * se ve si está activa y cuándo se usó.
 */
export function ShortcutsKey({ active, lastUsed }: { active: boolean; lastUsed: string | null }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ token?: string; error?: string }>({});
  const android = useSyncExternalStore(noSubscribe, isAndroid, () => false);

  function create() {
    if (active && !confirm("¿Crear otra clave? Los atajos con la clave anterior dejarán de funcionar.")) return;
    start(async () => setResult(await createApiToken()));
  }

  return (
    <div className="space-y-2">
      {result.token ? (
        <>
          <CopyField label="Tu clave (cópiala ahora, no se vuelve a mostrar)" value={result.token} />
          {android && (
            // Lo abre la app de Android (ConnectActivity), que pide confirmar antes de guardar.
            <a
              href={`wasted://conectar?clave=${encodeURIComponent(result.token)}`}
              className="flex h-12 items-center justify-center rounded-xl bg-foreground font-medium text-background active:scale-[0.98]"
            >
              Conectar widget de Android
            </a>
          )}
          <Link
            href="/ajustes/atajos"
            className="flex h-12 items-center justify-center rounded-xl bg-foreground font-medium text-background active:scale-[0.98]"
          >
            Configurar en el celular
          </Link>
        </>
      ) : active ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 ring-1 ring-border">
          <span className="min-w-0">
            <span className="block">Clave activa</span>
            <span className="block truncate text-sm text-muted">
              {lastUsed ? `Usada ${lastUsed}` : "Aún no se ha usado"}
            </span>
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("¿Revocar la clave? Tus atajos y widgets dejarán de funcionar.")) {
                start(() => revokeApiToken());
              }
            }}
            className="shrink-0 rounded-lg px-2 py-1 text-sm text-danger active:scale-[0.97] disabled:opacity-50"
          >
            Revocar
          </button>
        </div>
      ) : null}

      {!result.token && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={create}
            className="h-12 rounded-xl bg-foreground font-medium text-background transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? "Creando…" : active ? "Crear otra" : "Crear clave"}
          </button>
          <Link
            href="/ajustes/atajos"
            className="flex h-12 items-center justify-center rounded-xl bg-surface font-medium ring-1 ring-border active:scale-[0.98]"
          >
            Ver la guía
          </Link>
        </div>
      )}
      {result.error && (
        <p role="alert" className="px-1 text-sm text-danger">
          {result.error}
        </p>
      )}
    </div>
  );
}
