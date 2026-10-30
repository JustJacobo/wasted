# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Uso de skills (regla del proyecto)

Usa por iniciativa propia la skill que corresponda cada vez que mejore el resultado o ahorre pasos. No esperes a que el usuario la pida. Antes de una tarea, revisa si alguna skill de `.claude/skills/` (o de las disponibles en la sesión) la cubre y cárgala primero. Correspondencias habituales en este proyecto:

| Tarea | Skill |
|---|---|
| UI para celular, PWA, inputs, safe areas | `mobile-native` |
| Diseño visual y pulido de componentes | `emil-design-eng`, `minimalist-ui`, `high-end-visual-design` |
| Animaciones y transiciones | `animate`, `review-animations`, `animation-performance` |
| Probar una pantalla con datos extremos | `break-ui` |
| Toasts (Sonner) | `ask-sonner` |
| Gráficos, reportes y dashboards | `dataviz` |
| Código que llama a Claude (`@anthropic-ai/sdk`) | `claude-api` |
| Revisar cambios antes de cerrar | `code-review`, `simplify`, `security-review` |
| Correr la app y verificar un cambio | `run` |

Cuando uses una skill, dilo en una línea.

## Producto

Wasted es una app de finanzas personales (Colombia, COP), multiusuario por invitación. Lo prioritario es que **registrar un gasto o ingreso tome segundos**: el usuario abandonó otras apps y Notion por tener demasiados pasos. Ninguna feature debe añadir pasos al registro. El plan por fases está en `~/.claude/plans/valiant-growing-eclipse.md`.

Las categorías por defecto y las palabras clave salen del dashboard que el usuario tenía en Notion: cuota semanal como ingreso principal, mucho transporte (Uber, DiDi, Yango) y la métrica "te quedan $X esta semana".

## Comandos

```bash
npm run dev          # Next.js en http://localhost:3000
npm test             # Vitest (una vez)
npx vitest run src/lib/quick-add/parse.test.ts   # un archivo
npx vitest run -t "montos"                        # tests por nombre
npm run typecheck    # tsc --noEmit
npm run lint
npx supabase start   # Postgres/Auth local en Docker (Docker Desktop debe estar abierto)
npx supabase db reset  # recrea la BD local aplicando supabase/migrations
```

## Arquitectura

- **Next.js 16 (App Router)**. `cacheComponents` está apagado a propósito: casi todo depende de la sesión. El middleware se llama `src/proxy.ts`. Antes de usar una API de Next, consulta `node_modules/next/dist/docs/`.
- **Supabase**: Postgres + Auth (Google y enlace mágico) + RLS por `user_id`. El esquema está en `supabase/migrations/`. Un trigger sobre `auth.users` crea las categorías y la cuenta por defecto. Los montos se guardan como `bigint` en pesos y las fechas como `date` en hora de Colombia (`src/lib/dates.ts`).
- **Auth**: `requireUser()` en `src/lib/auth.ts` es la puerta de toda página y Server Action. Solo entran correos de la tabla `members` (los dueños invitan desde /ajustes); RLS además exige `is_member()`.
- **Registro en la web (vía principal)**: `src/app/add/`. `AddLauncher` muestra la barra "− Gasto / + Ingreso" y abre `AddSheet` al entrar a la app.
  - El sheet tiene 2 pasos: monto con teclado propio (`src/lib/amount-keypad.ts`) y luego categoría, que al tocarla guarda con la Server Action `addTransaction`.
  - Las categorías salen ordenadas por uso (`src/lib/category-usage.ts`).
  - El sheet agrega una entrada al historial para que Atrás lo cierre.
  - `?nuevo=gasto|ingreso` (accesos directos del manifest) elige el tipo inicial.
  - El ⌨ del sheet abre el modo texto secundario (`text-step.tsx`).
- **Registro por texto** (modo ⌨, Telegram y futuro WhatsApp): todo pasa por `recordQuickEntry()` en `src/lib/record.ts`. El flujo es:
  1. `parseQuickAdd` (`src/lib/quick-add/parse.ts`) interpreta montos como `25k`, `1.5M`, `20 lucas` o `$25.000`, fechas como `ayer`, `el lunes` o `15/10`, y decide si es gasto o ingreso (`+` o palabras clave).
  2. `matchCategory` busca en las reglas aprendidas (`category_rules`) y luego en las palabras clave integradas (`keywords.ts`, indexadas por `categories.key`).
  3. Si nada coincide, `suggestCategory` le pregunta a Claude Haiku (`src/lib/ai/categorize.ts`, se omite sin `ANTHROPIC_API_KEY`).
  4. Si tampoco hay respuesta, usa "Varios" u "Otros".
- **Inicio y Dashboard**: `src/app/home-pager.tsx` pone ambos paneles lado a lado. Se cambia deslizando (scroll-snap nativo) o con las pestañas.
  - El paginador y los paneles deben ser `relative`: si no, los elementos absolutos (`sr-only`) escapan del recorte y ensanchan la página en el celular.
  - `?vista=dashboard` abre directo en el dashboard, y en ese caso no se abre la ventana de registro.
  - `/reportes` redirige ahí.
- **Dashboard / reportes** (`/?vista=dashboard&periodo=semana|mes&fecha=YYYY-MM-DD`, contenido en `src/app/reportes/report-view.tsx`, datos con `getReport`):
  - Toda la agregación es pura y está testeada en `src/lib/report.ts` (`buildReport`, rangos lunes–domingo y mes calendario, comparación con el periodo anterior).
  - Los gráficos son HTML/CSS a mano, en un solo tono `--viz`, validado con la skill `dataviz` para modo claro y oscuro.
  - Las variaciones llevan ▲▼ coloreado y el texto en tinta neutra.
  - Las cifras grandes ajustan su tamaño con `sizeForLength` (`src/lib/money.ts`) en vez de recortarse.
- **Saldo y presupuesto** (`src/lib/budget.ts`, puro y testeado): el saldo no se reinicia cada lunes.
  - `carry` es lo que sobró o faltó antes del lunes (función SQL `totals_before`, llamada desde `fetchSummary`).
  - Lo disponible en la semana es `carry` + lo que entró. "Te quedan" es lo disponible menos lo que salió, es decir, el saldo total.
  - La mecha y los avisos del 80% y del 100% miden el gasto de la semana contra lo disponible (`WeekBudget`).
- **Aprendizaje**: cuando el usuario corrige una categoría, `learnCategory` guarda la descripción plegada (sin tildes, en minúsculas) como regla.
- **Telegram** (`src/lib/telegram/`, webhook en `src/app/api/telegram/route.ts`):
  - El webhook valida `X-Telegram-Bot-Api-Secret-Token`, que se deriva del token del bot (`webhookSecret`). `ensureWebhook` lo registra (con los comandos) al tocar "Conectar Telegram" si no apunta a esta app; `/api/telegram/setup` (con `CRON_SECRET`) hace lo mismo a mano.
  - Vinculación: Ajustes crea un código de un solo uso (15 min, guardado como hash) y abre `t.me/<bot>?start=<código>`. Tabla `telegram_links`: un chat por usuario, solo chats privados, y en cada mensaje se verifica que el usuario siga en `members`.
  - Todo usa el cliente de servicio, así que cada consulta filtra por `user_id`. `recordQuickEntry` recibe `userId` y `externalId = tg:<chat>:<mensaje>` para que un reintento de Telegram no duplique.
  - Mensajes y botones puros y testeados en `format.ts` (HTML de Telegram escapado; los uuid van en base64url para caber en `callback_data`).
  - Los reportes programados salen por correo y por Telegram; registrar desde la web avisa por Telegram al cruzar el 80% o el 100% de lo disponible en la semana (`notify.ts`, dentro de `after()`).
  - En local: `TELEGRAM_API_URL` apunta a un servidor falso del Bot API.
- **Atajos y widgets** (Atajos y Scriptable en iPhone, HTTP Shortcuts en Android; guía en `/ajustes/atajos`):
  - Clave personal `wst_…` creada en Ajustes. En `api_tokens` queda solo su hash (`src/lib/api-token.ts`), una por usuario.
  - `userFromRequest` (`src/lib/api-auth.ts`) lee `Authorization: Bearer`, busca el hash con el cliente de servicio y verifica `members` en cada llamada (`memberInfo`, `src/lib/members.ts`).
  - `POST /api/atajos/registrar` (JSON `texto`, formulario o texto plano) pasa por `recordQuickEntry` con `source = 'shortcut'`. `GET /api/atajos/saldo` da el saldo para widgets.
  - Con `?formato=texto` responden solo el mensaje, para mostrarlo tal cual. Los textos son puros y testeados en `src/lib/shortcut-format.ts`.
- **App de Android** (`android/`, Gradle 9.4 + AGP 9.2, Java, sin Kotlin; se instala como APK, sin tienda):
  - Es una TWA (`androidbrowserhelper`): abre la web en Chrome a pantalla completa, así que el login con Google funciona y cada despliegue llega solo. Un WebView (Capacitor) no sirve porque Google bloquea su login ahí.
  - `public/.well-known/assetlinks.json` tiene la huella del certificado de release (el proxy deja pasar `.well-known/` sin sesión). Si cambia el keystore, hay que actualizar la huella o vuelve la barra de dirección.
  - Lo nativo usa la API de atajos con la clave `wst_…`:
    - `BalanceWidget` muestra "Te quedan" y se actualiza cada 30 min, con ↻ y al registrar.
    - `QuickAddActivity` es el cuadro "¿Qué registras?" con botones fijos guardados en el teléfono.
    - `ConnectActivity` recibe `wasted://conectar?clave=…` desde Ajustes y siempre muestra la cuenta y pide confirmar antes de guardar.
  - Publicar: subir un tag `android-vX.Y.Z`. `.github/workflows/android-release.yml` compila con el keystore de los secretos del repo (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`), pasa `-PversionName`/`-PversionCode` (1.2.3 → 10203), falla si la huella no coincide con `assetlinks.json` y sube `wasted.apk` al Release. Ajustes y el README enlazan a `releases/latest/download/wasted.apk`.
  - Compilar en local (para probar): `cd android && gradlew assembleRelease` con `JAVA_HOME` en el JBR de Android Studio.
  - La variante debug (`app.wasted.android.debug`) apunta a `http://10.0.2.2:3000` (`npm run dev` visto desde el emulador).
  - Firma: el keystore está en `%USERPROFILE%\.wasted\` y la contraseña en `android/keystore.properties`; los dos quedan fuera de git. Sin ese keystore no se pueden instalar actualizaciones encima: hay que respaldarlo.
- **Importar del correo** (`src/lib/mail-import/`; solo el buzón de `GMAIL_USER`, por IMAP con la contraseña de aplicación):
  - `source.ts` busca en Gmail (`X-GM-RAW`) desde el lunes en que se activó, salta los Message-ID ya procesados y convierte el HTML a texto con `html.ts` (separa las celdas de las tablas).
  - `parsers.ts` (puro y testeado con textos reales): Nequi (Bre-B, PSE, Cívica), Uber, Rappi, facturas DIAN (XML dentro del ZIP, con límite de tamaño) y un genérico por "Total". Las transferencias propias (tu nombre o el pago a la tarjeta Nu) no cuentan.
  - `ingest.ts`: lo claro queda `confirmed`; lo de baja confianza o parecido a algo ya registrado (mismo tipo y monto, ±1 día) queda `pending` en `/bandeja`. Descartar lo deja `discarded` (conserva su `external_id`, así no vuelve). `mail_messages` registra cada correo procesado.
  - Se revisa al abrir la app (`after()`, cada 10 min como máximo), con "Revisar correo ahora", con el cron diario `/api/correo/sincronizar` y con `/correo` en Telegram.
  - En local: `MAIL_FIXTURES_DIR` (carpeta de `.eml`) y `MAIL_FIXTURES_USER` reemplazan a Gmail.
- **Recurrentes** (arriendo, suscripciones, cuota semanal; tabla `recurring`):
  - `src/lib/recurring.ts` (puro y testeado): frecuencia `every` + `unit` (día, semana, mes, año). Cada fecha se calcula desde `starts_on`, así un mensual del 31 cae el 30 en noviembre y vuelve al 31. `next_on` es la próxima por generar.
  - `generateDue` (`src/lib/recurring-run.ts`, cliente de servicio) crea lo vencido como `pending` con `source = 'recurring'`, `recurring_id` y `external_id = rec:<regla>:<fecha>` (correr dos veces no duplica; lo omitido no vuelve). Si ya hay algo igual (±1 día, confirmado o pendiente del correo) lo marca `possibleDuplicateOf`; `ingest.ts` hace lo mismo al revés.
  - Corre en el cron diario `/api/recurrentes/generar` (6:00) y en el `after()` del inicio; avisa por Telegram con [✓ Agregar] [Esta vez no] (callbacks `p:` y `n:`). Solo cuenta en el saldo cuando se confirma.
  - Se crea desde un movimiento ("Repetir" en `/movimientos/[id]`: ese movimiento es la primera vez) o en Ajustes › Recurrentes, donde se edita, pausa (al reanudar no trae lo vencido en la pausa) o elimina (borra lo que generó sin confirmar).
