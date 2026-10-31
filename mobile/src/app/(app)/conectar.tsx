import { Redirect } from "expo-router";

/**
 * wasted://conectar?clave=… venía del botón "Conectar widget de Android" de la
 * web (la app anterior). Ahora el widget se conecta solo al entrar: va al inicio.
 */
export default function ConnectRedirect() {
  return <Redirect href="/" />;
}
