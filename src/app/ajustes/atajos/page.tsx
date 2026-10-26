import Link from "next/link";
import type { ReactNode } from "react";
import { appUrl } from "@/lib/app-url";
import { requireUser } from "@/lib/auth";
import { CopyField } from "../copy-field";

type System = "iphone" | "android";

/** Widget de Scriptable (iPhone): "Te quedan" en la pantalla de inicio. */
function scriptableWidget(base: string): string {
  return `// Wasted · widget "Te quedan" para Scriptable.
// En el widget, pon tu clave de Wasted (wst_…) en "Parámetro".
const SALDO = "${base}/api/atajos/saldo";
const key = (args.widgetParameter || "").trim();
const w = new ListWidget();
w.url = "${base}/";
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

function line(text, size, opacity = 1, bold = false) {
  const t = w.addText(text);
  t.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size);
  t.textOpacity = opacity;
  t.minimumScaleFactor = 0.5;
  t.lineLimit = 2;
  return t;
}

if (!key) {
  line("Wasted", 13, 1, true);
  line("Mantén pulsado el widget → Editar widget → Parámetro: pega tu clave.", 11, 0.7);
} else {
  try {
    const req = new Request(SALDO);
    req.headers = { Authorization: "Bearer " + key };
    const s = await req.loadJSON();
    if (!s.ok) throw new Error(s.mensaje);
    line(s.titulo, 12, 0.6);
    const n = line(s.cifra, 26, 1, true);
    if (s.nivel !== "none" && s.teQuedan < 0) n.textColor = Color.red();
    w.addSpacer(6);
    line("Semana: +" + s.semana.entro.toLocaleString("es-CO") + " · -" + s.semana.salio.toLocaleString("es-CO"), 11, 0.7);
  } catch (e) {
    line("Wasted", 13, 1, true);
    line(String(e.message || "No pude leer el saldo"), 11, 0.7);
  }
}

w.addSpacer();
const f = new DateFormatter();
f.useShortTimeStyle();
line("Actualizado " + f.string(new Date()), 9, 0.5);

if (config.runsInWidget) Script.setWidget(w);
else await w.presentSmall();
Script.complete();
`;
}

function Steps({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="px-1 font-semibold tracking-tight">{title}</h2>
      <ol className="list-decimal space-y-2 pl-6 text-sm leading-relaxed marker:text-muted">{children}</ol>
    </section>
  );
}

const B = ({ children }: { children: ReactNode }) => <strong className="font-medium">{children}</strong>;

export default async function ShortcutsGuidePage({ searchParams }: PageProps<"/ajustes/atajos">) {
  await requireUser();
  const { so } = await searchParams;
  const system: System = so === "android" ? "android" : "iphone";
  const base = appUrl();
  const register = `${base}/api/atajos/registrar?formato=texto`;
  const balance = `${base}/api/atajos/saldo?formato=texto`;

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-2 py-2">
        <Link href="/ajustes" className="rounded-lg px-2 py-1 text-sm text-muted active:scale-[0.97]">
          ← Ajustes
        </Link>
        <h1 className="flex-1 text-right text-lg font-bold tracking-tight">Atajos y widgets</h1>
      </header>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1 ring-1 ring-border">
        {(["iphone", "android"] as const).map((s) => (
          <Link
            key={s}
            href={s === "android" ? "/ajustes/atajos?so=android" : "/ajustes/atajos"}
            replace
            aria-current={s === system ? "page" : undefined}
            className={`grid h-10 place-items-center rounded-xl text-sm font-medium transition-colors duration-150 ${
              s === system ? "bg-foreground text-background" : "text-muted"
            }`}
          >
            {s === "android" ? "Android" : "iPhone"}
          </Link>
        ))}
      </div>

      <p className="px-1 text-sm text-muted">
        Necesitas tu clave de{" "}
        <Link href="/ajustes" className="underline">
          Ajustes → Atajos y widgets
        </Link>
        . Donde diga <B>Bearer tu-clave</B>, escribe <B>Bearer</B>, un espacio y la clave (empieza por
        wst_). Se registra igual que en Telegram: “25k almuerzo”, “+200k cuota semanal”, “6k uber
        ayer”.
      </p>

      <div className="space-y-2">
        <CopyField label="Dirección para registrar" value={register} />
        <CopyField label="Dirección del saldo" value={balance} />
      </div>

      {system === "iphone" ? (
        <>
          <Steps title="Registrar con un toque o con Siri">
            <li>
              Abre <B>Atajos</B>, toca <B>+</B> y llámalo <B>Wasted</B>.
            </li>
            <li>
              Agrega <B>Solicitar entrada</B> (texto) con la pregunta “¿Qué registras?”.
            </li>
            <li>
              Agrega <B>Obtener contenido de URL</B> con la dirección para registrar. En <B>Mostrar más</B>:
              método <B>POST</B>; en <B>Encabezados</B>, <B>Authorization</B> = <B>Bearer tu-clave</B>; en{" "}
              <B>Cuerpo de la solicitud</B>, <B>JSON</B> con un campo de texto <B>texto</B> = <B>Entrada proporcionada</B>.
            </li>
            <li>
              Agrega <B>Mostrar notificación</B> con <B>Contenido de la URL</B>.
            </li>
            <li>
              Ponlo donde quieras: widget de Atajos en la pantalla de inicio, el <B>botón de acción</B>{" "}
              (Configuración → Botón de acción → Atajo) o dile “Oye Siri, Wasted” y dicta.
            </li>
          </Steps>

          <Steps title="Botones fijos para lo de siempre">
            <li>
              Duplica el atajo <B>Wasted</B> y renómbralo, por ejemplo “Uber 6k”.
            </li>
            <li>
              Borra <B>Solicitar entrada</B> y en el campo <B>texto</B> escribe lo fijo: “6k uber” o “+200k
              cuota semanal”.
            </li>
            <li>
              Agrega el widget mediano de Atajos: muestra cuatro botones de una vez.
            </li>
          </Steps>

          <Steps title="Widget con lo que te queda">
            <li>
              Instala <B>Scriptable</B> (gratis en la App Store), toca <B>+</B>, pega el script de abajo y
              llámalo <B>Wasted</B>.
            </li>
            <li>
              En la pantalla de inicio agrega un widget pequeño de Scriptable, mantenlo pulsado →{" "}
              <B>Editar widget</B>: <B>Script</B> = Wasted y en <B>Parámetro</B> pega tu clave.
            </li>
            <li>iOS lo actualiza cada 15 minutos o más; al tocarlo abre Wasted.</li>
          </Steps>
          <CopyField label="Script para Scriptable" value={scriptableWidget(base)} multiline />
        </>
      ) : (
        <>
          <p className="rounded-xl bg-surface px-4 py-3 text-sm ring-1 ring-border">
            Con la <B>app de Android</B> (Ajustes → Descargar la app) no necesitas nada de esto: trae su
            propio widget. Al crear la clave toca <B>Conectar widget de Android</B> y agrega el widget
            Wasted en la pantalla de inicio. Lo de abajo sirve si prefieres no instalarla.
          </p>

          <Steps title="Registrar con un toque">
            <li>
              Instala <B>HTTP Shortcuts</B> (gratis en Play Store).
            </li>
            <li>
              En el menú <B>⋮ → Variables</B>, toca <B>+</B> → <B>Entrada de texto</B> (Text input), nombre{" "}
              <B>texto</B> y título “¿Qué registras?”.
            </li>
            <li>
              Vuelve, toca <B>+</B> → <B>Solicitud HTTP normal</B> y llámalo <B>Wasted</B>. Método{" "}
              <B>POST</B> y la dirección para registrar.
            </li>
            <li>
              En <B>Encabezados de solicitud</B>, agrega <B>Authorization</B> = <B>Bearer tu-clave</B>.
            </li>
            <li>
              En <B>Cuerpo de la solicitud</B>, elige <B>Texto personalizado</B> (tipo text/plain) e inserta
              la variable <B>texto</B> con el botón <B>{"{}"}</B>.
            </li>
            <li>
              En <B>Manejo de respuesta</B>, muéstrala como <B>Aviso (toast)</B>.
            </li>
            <li>
              Guarda, mantén pulsado el acceso → <B>Colocar en la pantalla de inicio</B>.
            </li>
          </Steps>

          <Steps title="Botones fijos para lo de siempre">
            <li>
              Mantén pulsado <B>Wasted</B> → <B>Duplicar</B> y renómbralo, por ejemplo “Uber 6k”.
            </li>
            <li>
              En el cuerpo, cambia la variable por el texto fijo: “6k uber” o “+200k cuota semanal”.
            </li>
            <li>Colócalo en la pantalla de inicio: un toque y queda registrado.</li>
          </Steps>

          <Steps title="Ver lo que te queda">
            <li>
              Crea otro acceso <B>Saldo</B>: método <B>GET</B>, la dirección del saldo y el mismo encabezado{" "}
              <B>Authorization</B>.
            </li>
            <li>
              Muestra la respuesta como <B>Diálogo</B> y colócalo en la pantalla de inicio.
            </li>
            <li>
              Cada registro también responde con lo que te queda. El widget que muestra el saldo siempre
              llega con la app de Android.
            </li>
          </Steps>
        </>
      )}

      <p className="px-1 text-xs text-muted">
        Si cambias o revocas la clave en Ajustes, actualízala en tus atajos. Nadie más puede usar tus
        atajos sin la clave.
      </p>
    </main>
  );
}
