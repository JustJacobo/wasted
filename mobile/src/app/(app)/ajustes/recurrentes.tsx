import { Redirect } from "expo-router";

/** Recurrentes salió de Ajustes: ahora está en el Plan (/recurrentes). */
export default function OldRecurringRoute() {
  return <Redirect href="/recurrentes" />;
}
