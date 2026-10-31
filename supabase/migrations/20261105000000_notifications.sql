-- Registro por notificaciones del teléfono: la app de Android lee las de
-- Nequi, Nu, DiDi, Uber y Yango y las manda a /api/notificaciones.

alter type public.tx_source add value if not exists 'notification';

-- Cada notificación procesada: evita repetirla si el teléfono la reenvía y
-- deja ver en Ajustes qué se leyó y qué pasó con cada una.
create table public.notification_log (
  user_id uuid not null references auth.users on delete cascade,
  -- sha256 del paquete, la hora y el texto.
  id text not null,
  package text not null,
  title text not null default '',
  text text not null default '',
  posted_at timestamptz not null,
  outcome text not null check (outcome in ('recorded', 'pending', 'own_transfer', 'ignored', 'duplicate')),
  transaction_id uuid references public.transactions on delete set null,
  processed_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index notification_log_processed_idx on public.notification_log (user_id, processed_at desc);

alter table public.notification_log enable row level security;

-- Solo lectura para el propio usuario; escribe el cliente de servicio.
create policy "own notification log read" on public.notification_log for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()));
