import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState } from "react-native";
import { ApiError } from "./api";
import { refreshWidgetOnHome } from "./device";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Un 401 o 403 no se arregla reintentando.
      retry: (failures, error) => !(error instanceof ApiError && [400, 401, 403, 404].includes(error.status)) && failures < 2,
    },
  },
});

refreshWidgetOnHome(queryClient);

/**
 * Después de escribir algo: un movimiento cambia el saldo, los reportes, el
 * historial y la bandeja a la vez, así que todo lo leído queda viejo (la web
 * hace lo mismo con revalidatePath). Lo que está en pantalla se recarga ya; lo
 * demás, al volver a verlo. La cuenta (me) no cambia.
 */
export const refreshAfterWrite = () => queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "me" });

// Al volver a la app se recargan los datos que ya pasaron de tiempo, como al volver a la pestaña en la web.
AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));
