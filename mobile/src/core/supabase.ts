import "react-native-url-polyfill/auto";
import "./crypto-polyfill";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

/**
 * Supabase solo para la sesión (login, refresco del token). Los datos van por
 * la API de la web (`api()`), que usa la misma lógica que la página.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // El código del login vuelve por wasted://auth/callback?code=… y se canjea aquí.
    flowType: "pkce",
  },
});

// El token se refresca solo mientras la app está en primer plano.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
