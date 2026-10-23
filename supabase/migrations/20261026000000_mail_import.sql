-- Importar movimientos desde el correo (Gmail por IMAP).

-- Lo descartado en la bandeja se conserva (con su external_id) para que no vuelva a entrar.
alter type public.tx_status add value if not exists 'discarded';

-- Estado de la sincronización por usuario. Lo escribe el servidor (clave de servicio).
create table public.mail_sync (
  user_id uuid primary key references auth.users on delete cascade,
  enabled boolean not null default true,
  -- Primer día que se importa (no se traen correos anteriores).
  since date not null,
  last_synced_at timestamptz,
  -- Candado simple para no correr dos sincronizaciones a la vez.
  running_until timestamptz
);

-- Cada correo procesado, con lo que se hizo con él. Evita reprocesarlo.
create table public.mail_messages (
  user_id uuid not null references auth.users on delete cascade,
  message_id text not null,
  received_at timestamptz not null,
  outcome text not null check (outcome in ('recorded', 'pending', 'own_transfer', 'ignored', 'duplicate')),
  transaction_id uuid references public.transactions on delete set null,
  processed_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

create index mail_messages_received_idx on public.mail_messages (user_id, received_at desc);

alter table public.mail_sync enable row level security;
alter table public.mail_messages enable row level security;

create policy "own mail sync read" on public.mail_sync for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()));
-- Pausar o reanudar desde Ajustes.
create policy "own mail sync update" on public.mail_sync for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));

create policy "own mail messages read" on public.mail_messages for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()));
