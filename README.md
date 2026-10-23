# Wasted

App personal de finanzas: registras un gasto escribiendo `25k almuerzo` y listo.

## Correr en local

Requisitos: Node 22 y Docker Desktop abierto.

```bash
npm install
npx supabase start      # Postgres + Auth + Mailpit en Docker; aplica supabase/migrations
cp .env.example .env.local
# Copia API_URL y PUBLISHABLE_KEY de `npx supabase status` a .env.local
npm run dev
```

Abre http://localhost:3000 y entra con "Enviar enlace". En local el correo no sale a internet: ábrelo en Mailpit (http://127.0.0.1:54324). Supabase Studio queda en http://127.0.0.1:54323.

## Cómo registrar

Al abrir la app aparece la ventana de registro, y también la abren los botones **− Gasto** y **+ Ingreso** de abajo:

1. Escribe el monto con el teclado numérico y toca **Siguiente**.
2. Si quieres, cambia la fecha (Hoy ▾) o agrega una nota.
3. **Toca la categoría** y queda guardado. Las que más usas aparecen primero.

En Android, al mantener pulsado el ícono de la app aparecen los accesos directos **Añadir gasto** y **Añadir ingreso**.

### Modo texto (⌨)

En la ventana, el ícono ⌨ permite escribir todo en una línea:

| Escribes | Resultado |
|---|---|
| `25k almuerzo` | Gasto $25.000 · Comida · hoy |
| `25 almuerzo` | Igual: un número menor a 100 sin sufijo se lee como miles |
| `$25.000 uber` | Gasto $25.000 · Transporte |
| `20 lucas didi` | Gasto $20.000 |
| `1.5M arriendo` | Gasto $1.500.000 |
| `+200k cuota semanal` | Ingreso $200.000 · Cuota semanal |
| `ayer 30k taxi` / `el lunes 12k café` / `15/10 40k tienda` | Con la fecha indicada |

Si la categoría no es la correcta, tócala en la confirmación y la app la recordará para la próxima.

## Desplegar (Supabase + Vercel)

1. **Supabase:** crea un proyecto en supabase.com y aplica el esquema:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
2. **Google login:**
   - En Google Cloud, crea un OAuth Client (Web) con redirect `https://<ref>.supabase.co/auth/v1/callback`.
   - Pega el Client ID y el secret en Supabase → Authentication → Providers → Google.
3. **URLs de Auth:** en Supabase → Authentication → URL Configuration, pon `https://<tu-app>.vercel.app` como Site URL y agrega `https://<tu-app>.vercel.app/auth/callback` como redirect.
4. **Vercel:**
   - Importa el repo.
   - Define las variables de entorno: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y, opcionalmente, `ANTHROPIC_API_KEY`.
5. **En el celular:** abre la URL.
   - En Android, menú → "Instalar app".
   - En iPhone, Compartir → "Agregar a inicio".

## Desarrollo

Ver [CLAUDE.md](CLAUDE.md) para comandos y arquitectura.
