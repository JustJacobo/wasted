import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { focusManager, QueryClient } from "@tanstack/react-query";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import Constants from "expo-constants";
import { AppState } from "react-native";
import { ApiError } from "./api";
import { refreshWidgetOnHome } from "./device";

const DAY = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Lo guardado en el teléfono vive lo mismo que la caché en memoria (si no, se borraría a los 5 min).
      gcTime: 7 * DAY,
      // Un 401 o 403 no se arregla reintentando.
      retry: (failures, error) => !(error instanceof ApiError && [400, 401, 403, 404].includes(error.status)) && failures < 2,
    },
  },
});

refreshWidgetOnHome(queryClient);

/**
 * Lo último que se leyó queda en el teléfono: al abrir, el inicio pinta al
 * instante con eso y se actualiza detrás. Solo lo de las pantallas principales.
 */
const PERSISTED = new Set(["me", "home", "plan", "report", "settings"]);

export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: "wasted-cache", throttleTime: 1000 });

export const persistOptions: PersistQueryClientProviderProps["persistOptions"] = {
  persister,
  maxAge: 7 * DAY,
  // Una versión nueva de la app puede cambiar la forma de los datos: empieza de cero.
  buster: Constants.expoConfig?.version ?? "",
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.state.status === "success" && PERSISTED.has(String(query.queryKey[0])),
  },
};

/** Al salir: nada de esta cuenta queda en memoria ni en el teléfono. */
export async function forgetCache() {
  queryClient.clear();
  await persister.removeClient();
}

/**
 * Después de escribir algo: un movimiento cambia el saldo, los reportes, el
 * historial y la bandeja a la vez, así que todo lo leído queda viejo (la web
 * hace lo mismo con revalidatePath). Lo que está en pantalla se recarga ya; lo
 * demás, al volver a verlo. La cuenta (me) no cambia.
 */
export const refreshAfterWrite = () => queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "me" });

// Al volver a la app se recargan los datos que ya pasaron de tiempo, como al volver a la pestaña en la web.
AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));
