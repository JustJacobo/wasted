import "server-only";

import { NextResponse } from "next/server";

/**
 * Con `?formato=texto` responde solo el mensaje en texto plano: Atajos y HTTP
 * Shortcuts lo muestran tal cual en una notificación o un toast. Si no, JSON.
 */
export function respond(
  request: Request,
  body: { ok: boolean; mensaje: string; [key: string]: unknown },
  status = 200,
) {
  const headers = { "cache-control": "no-store" };
  if (new URL(request.url).searchParams.get("formato") === "texto") {
    return new Response(body.mensaje, {
      status,
      headers: { ...headers, "content-type": "text/plain; charset=utf-8" },
    });
  }
  return NextResponse.json(body, { status, headers });
}

export const UNAUTHORIZED = {
  ok: false,
  mensaje: "Clave no válida. Crea una nueva en Wasted → Ajustes → Atajos y widgets.",
} as const;
