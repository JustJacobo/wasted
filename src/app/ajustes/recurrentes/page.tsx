import { redirect } from "next/navigation";

/** Recurrentes salió de Ajustes: ahora está en el Plan. Se mantiene para enlaces viejos. */
export default function OldRecurringPage() {
  redirect("/recurrentes");
}
