-- Recurrentes: arriendo, suscripciones, la cuota semanal. Al vencer, el servidor
-- crea el movimiento como pendiente en la bandeja; cuenta cuando se confirma.

alter type public.tx_source add value if not exists 'recurring';

create table public.recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  type public.tx_type not null,
  amount bigint not null check (amount > 0),
  description text not null default '',
  category_id uuid references public.categories on delete set null,
  -- Cada `every` unidades, contadas siempre desde `starts_on` (un mensual del 31 no se corre).
  every int not null check (every between 1 and 365),
  unit text not null check (unit in ('day', 'week', 'month', 'year')),
  starts_on date not null,
  -- Próxima fecha que falta generar.
  next_on date not null,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recurring_user_idx on public.recurring (user_id);
create index recurring_due_idx on public.recurring (next_on) where not paused;

create trigger recurring_touch before update on public.recurring
  for each row execute function public.touch_updated_at();

alter table public.recurring enable row level security;

create policy "own recurring" on public.recurring for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));

-- El recurrente del que salió (o que se creó desde) cada movimiento.
alter table public.transactions
  add column recurring_id uuid references public.recurring on delete set null;

create index transactions_recurring_idx on public.transactions (recurring_id) where recurring_id is not null;
