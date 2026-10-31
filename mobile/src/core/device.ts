import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";
import { WastedAndroid } from "../../modules/wasted-android";
import { api } from "./api";
import { API_URL } from "./config";

// Lo nativo de Android (widget, registro rápido, notificaciones) llama a la API
// de atajos con una clave wst_ propia de este celular. La app la pide al entrar,
// la guarda en el lado nativo y la revoca al salir. Ajustes de la web la lista.

const STORED = "wasted.deviceKey";

interface Stored {
  id: string;
  userId: string;
}

/** "Google Pixel 8", "Samsung SM-S911B": así aparece en Ajustes. */
function deviceName(): string {
  const { Manufacturer = "", Model = "" } = Platform.constants as { Manufacturer?: string; Model?: string };
  const maker = Manufacturer.charAt(0).toUpperCase() + Manufacturer.slice(1);
  const name = Model.toLowerCase().startsWith(Manufacturer.toLowerCase()) ? Model : `${maker} ${Model}`;
  return name.trim().slice(0, 80) || "Android";
}

async function stored(): Promise<Stored | null> {
  const raw = await AsyncStorage.getItem(STORED);
  try {
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

/** Id de la clave de este celular (para marcarlo en la lista de Ajustes). */
export const currentDeviceKeyId = async () => (await stored())?.id ?? null;

/** Con sesión: deja lista la clave de este celular para la cuenta que entró. */
export async function connectDevice(userId: string): Promise<void> {
  if (!WastedAndroid) return;
  WastedAndroid.configure(API_URL);
  const current = await stored();
  if (current?.userId === userId && WastedAndroid.getKey()) return;
  const result = await api<{ id?: string; token?: string }>("createDeviceKey", { device: deviceName() });
  if (!result.id || !result.token) return;
  WastedAndroid.setKey(result.token);
  await AsyncStorage.setItem(STORED, JSON.stringify({ id: result.id, userId } satisfies Stored));
}

/** Al salir (con la sesión todavía abierta): revoca la clave y la borra del celular. */
export async function disconnectDevice(): Promise<void> {
  if (!WastedAndroid) return;
  const current = await stored();
  if (current) await api("revokeDeviceKey", { id: current.id }).catch(() => {});
  WastedAndroid.setKey(null);
  await AsyncStorage.removeItem(STORED);
}

/**
 * El widget se repinta cada vez que el inicio trae datos nuevos: después de
 * registrar, editar, confirmar en la bandeja o al volver a la app.
 */
export function refreshWidgetOnHome(client: QueryClient): () => void {
  if (!WastedAndroid) return () => {};
  return client.getQueryCache().subscribe((event) => {
    if (event.type === "updated" && event.action.type === "success" && event.query.queryKey[0] === "home") {
      WastedAndroid?.refreshWidget();
    }
  });
}
