-- Bot de Telegram: cada miembro vincula su chat privado con un código de un solo uso.

create table public.telegram_links (
  user_id uuid primary key references auth.users on delete cascade,
  chat_id bigint not null unique,
  username text,
  linked_at timestamptz not null default now()
);

-- Código del enlace t.me/<bot>?start=<código>. Se guarda solo su hash.
create table public.telegram_link_codes (
  code_hash text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes'
);

create index telegram_link_codes_user_idx on public.telegram_link_codes (user_id);

alter table public.telegram_links enable row level security;
alter table public.telegram_link_codes enable row level security;

-- El vínculo lo crea el webhook (clave de servicio); el usuario solo lo ve y lo borra.
create policy "own telegram link read" on public.telegram_links for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()));
create policy "own telegram link delete" on public.telegram_links for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()));

create policy "own telegram codes" on public.telegram_link_codes for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));
