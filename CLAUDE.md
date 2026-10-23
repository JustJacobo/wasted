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
- **Registro por texto** (modo ⌨ y futuro Telegram/WhatsApp): todo pasa por `recordQuickEntry()` en `src/lib/record.ts`. El flujo es:
  1. `parseQuickAdd` (`src/lib/quick-add/parse.ts`) interpreta montos como `25k`, `1.5M`, `20 lucas` o `$25.000`, fechas como `ayer`, `el lunes` o `15/10`, y decide si es gasto o ingreso (`+` o palabras clave).
  2. `matchCategory` busca en las reglas aprendidas (`category_rules`) y luego en las palabras clave integradas (`keywords.ts`, indexadas por `categories.key`).
  3. Si nada coincide, `suggestCategory` le pregunta a Claude Haiku (`src/lib/ai/categorize.ts`, se omite sin `ANTHROPIC_API_KEY`).
  4. Si tampoco hay respuesta, usa "Varios" u "Otros".
- **Reportes** (`/reportes?periodo=semana|mes&fecha=YYYY-MM-DD`):
  - Toda la agregación es pura y está testeada en `src/lib/report.ts` (`buildReport`, rangos lunes–domingo y mes calendario, comparación con el periodo anterior).
  - Los gráficos son HTML/CSS a mano, en un solo tono `--viz`, validado con la skill `dataviz` para modo claro y oscuro.
  - Las variaciones llevan ▲▼ coloreado y el texto en tinta neutra.
  - Las cifras grandes ajustan su tamaño con `sizeForLength` (`src/lib/money.ts`) en vez de recortarse.
- **Aprendizaje**: cuando el usuario corrige una categoría, `learnCategory` guarda la descripción plegada (sin tildes, en minúsculas) como regla.
