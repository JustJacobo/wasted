"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createTelegramLink, unlinkTelegram } from "./actions";

/** Conectar o desconectar el chat de Telegram. Al volver a la app, refresca el estado. */
export function TelegramConnect({ username, linked }: { username: string | null; linked: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [link, setLink] = useState<{ url?: string; error?: string }>({});

  useEffect(() => {
    if (linked || !link.url) return;
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [linked, link.url, router]);

  if (linked) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 ring-1 ring-border">
        <span className="min-w-0">
          <span className="block">Conectado</span>
          {username && <span className="block truncate text-sm text-muted">@{username}</span>}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm("¿Desconectar Telegram? El bot dejará de registrar tus mensajes.")) {
              start(() => unlinkTelegram());
            }
          }}
          className="shrink-0 rounded-lg px-2 py-1 text-sm text-danger active:scale-[0.97] disabled:opacity-50"
        >
          {pending ? "Desconectando…" : "Desconectar"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await createTelegramLink();
            setLink(result);
            if (result.url) window.location.href = result.url;
          })
        }
        className="h-12 w-full rounded-xl bg-foreground font-medium text-background transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "Abriendo Telegram…" : "Conectar Telegram"}
      </button>
      {link.error && (
        <p role="alert" className="px-1 text-sm text-danger">
          {link.error}
        </p>
      )}
      {link.url && (
        <p className="px-1 text-sm text-muted" aria-live="polite">
          En Telegram toca <strong className="text-foreground">Iniciar</strong>. Si no se abrió,{" "}
          <a href={link.url} className="font-medium text-foreground underline">
            toca aquí
          </a>
          . El enlace sirve 15 minutos.
        </p>
      )}
    </div>
  );
}
