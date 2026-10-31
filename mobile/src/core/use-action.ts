import { useState } from "react";
import { api, ApiError } from "./api";
import { refreshAfterWrite } from "./query";

/** Corre una operación de la API, muestra su mensaje o error y refresca lo leído. */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  async function run(op: string, input?: unknown, onOk?: () => void): Promise<boolean> {
    setPending(true);
    setNotice(null);
    try {
      const result = await api<{ error?: string; message?: string } | null>(op, input);
      if (result?.error) {
        setNotice({ text: result.error, error: true });
        return false;
      }
      if (result?.message) setNotice({ text: `${result.message}.`, error: false });
      await refreshAfterWrite();
      onOk?.();
      return true;
    } catch (e) {
      setNotice({ text: e instanceof ApiError ? e.message : "No pude guardarlo.", error: true });
      return false;
    } finally {
      setPending(false);
    }
  }

  return { pending, notice, run, clear: () => setNotice(null) };
}
