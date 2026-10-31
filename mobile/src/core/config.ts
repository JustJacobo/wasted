// Producción por defecto. En desarrollo, mobile/.env.development.local apunta
// al emulador: EXPO_PUBLIC_API_URL=http://10.0.2.2:3000, etc. (10.0.2.2 es el
// computador visto desde el emulador de Android).

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://wasted-lilac.vercel.app";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://rjudohhooissebgbswcr.supabase.co";

/** Clave pública (la misma que lleva la web); los datos los protege RLS. */
export const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "sb_publishable_fKvve2odysmb4I2frh-POg_vZSsTBpQ";

/** A dónde vuelve el login (Google y enlace mágico). */
export const AUTH_REDIRECT = "wasted://auth/callback";
