"use client";

import { useTransition } from "react";
import { revokeDeviceKey } from "./actions";

/** Desconecta el widget y las notificaciones de un celular con la app. */
export function DeviceButton({ id, device }: { id: string; device: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(`¿Desconectar ${device}? Su widget y la lectura de notificaciones dejan de funcionar hasta que vuelvas a entrar en la app.`)) {
          start(() => revokeDeviceKey(id));
        }
      }}
      className="shrink-0 rounded-lg px-2 py-1 text-sm text-danger active:scale-[0.97] disabled:opacity-50"
    >
      {pending ? "Desconectando…" : "Desconectar"}
    </button>
  );
}
