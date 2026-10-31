-- Préstamos y metas: plata que sale o entra de tu bolsillo sin ser un gasto ni
-- un ingreso. Baja o sube "Te quedan", pero no aparece en los reportes.

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  person text not null check (length(person) between 1 and 60),
  -- lent: tú prestaste (te deben). borrowed: te prestaron (debes).
  direction text not null check (direction in ('lent', 'borrowed')),
  created_at timestamptz not null default now(),
  -- Cuando lo pendiente llega a cero.
  closed_at timestamptz
);

create index loans_user_idx on public.loans (user_id) where closed_at is null;

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 60),
  target bigint check (target > 0),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index goals_user_idx on public.goals (user_id);

-- Cada movimiento con su efecto en el saldo: prestar o apartar es negativo; que
-- te paguen, que te presten o sacar de una meta es positivo.
create table public.balance_moves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  occurred_on date not null default (now() at time zone 'America/Bogota')::date,
  amount bigint not null check (amount <> 0),
  loan_id uuid references public.loans on delete cascade,
  goal_id uuid references public.goals on delete cascade,
  -- Mensaje de Telegram o atajo que lo creó: un reintento no lo repite.
  external_id text,
  created_at timestamptz not null default now(),
  check ((loan_id is null) <> (goal_id is null)),
  unique (user_id, external_id)
);

create index balance_moves_user_day_idx on public.balance_moves (user_id, occurred_on);
create index balance_moves_loan_idx on public.balance_moves (loan_id) where loan_id is not null;
create index balance_moves_goal_idx on public.balance_moves (goal_id) where goal_id is not null;

alter table public.loans enable row level security;
alter table public.goals enable row level security;
alter table public.balance_moves enable row level security;

create policy "own loans" on public.loans for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));

create policy "own goals" on public.goals for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));

-- Un movimiento solo puede apuntar a un préstamo o una meta del mismo usuario.
create policy "own balance moves" on public.balance_moves for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (
    user_id = (select auth.uid())
    and (select public.is_member())
    and (loan_id is null or exists (select 1 from public.loans l where l.id = loan_id and l.user_id = (select auth.uid())))
    and (goal_id is null or exists (select 1 from public.goals g where g.id = goal_id and g.user_id = (select auth.uid())))
  );

-- El saldo con que arranca la semana ahora también cuenta lo prestado y lo apartado.
drop function public.totals_before(date, uuid);

create function public.totals_before(p_before date, p_user uuid default null)
returns table (income bigint, expense bigint, moved bigint)
language sql stable security invoker set search_path = '' as $$
  select
    (select coalesce(sum(t.amount) filter (where t.type = 'income'), 0)::bigint
       from public.transactions t
      where t.status = 'confirmed' and t.occurred_on < p_before and (p_user is null or t.user_id = p_user)),
    (select coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)::bigint
       from public.transactions t
      where t.status = 'confirmed' and t.occurred_on < p_before and (p_user is null or t.user_id = p_user)),
    (select coalesce(sum(m.amount), 0)::bigint
       from public.balance_moves m
      where m.occurred_on < p_before and (p_user is null or m.user_id = p_user));
$$;

revoke execute on function public.totals_before(date, uuid) from public, anon;
grant execute on function public.totals_before(date, uuid) to authenticated, service_role;
