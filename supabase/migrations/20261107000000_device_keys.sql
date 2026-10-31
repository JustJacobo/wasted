-- Varias claves por usuario: la de atajos (una, la que se crea en Ajustes) y una
-- por celular con la app nativa, que la crea al iniciar sesión (widget, registro
-- rápido y notificaciones) y la revoca al cerrarla.

alter table public.api_tokens drop constraint api_tokens_pkey;

alter table public.api_tokens
  add column id uuid not null default gen_random_uuid() primary key,
  -- null: la clave de atajos; si no, el nombre del celular ("Google Pixel 8").
  add column device text check (char_length(device) between 1 and 80);

create index api_tokens_user_id_idx on public.api_tokens (user_id);

-- Una sola clave de atajos por usuario, como antes.
create unique index api_tokens_one_shortcut_key on public.api_tokens (user_id) where device is null;
