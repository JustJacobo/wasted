-- Esquema base de Wasted: cuentas, categorías, movimientos y reglas de categorización.
-- Cada fila pertenece a un usuario y RLS impide ver datos de otros.

create type public.tx_type as enum ('expense', 'income');
create type public.tx_source as enum (
  'manual', 'telegram', 'email_bank', 'email_invoice', 'email_other', 'receipt_photo'
);
create type public.tx_status as enum ('confirmed', 'pending');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  kind text not null default 'cash' check (kind in ('cash', 'debit', 'credit', 'savings')),
  -- Últimos 4 dígitos de la tarjeta, para asociar notificaciones del banco.
  last4 text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  -- Identificador estable de las categorías por defecto (las palabras clave
  -- integradas se asocian a este key, así que renombrarla no rompe nada).
  key text,
  name text not null,
  emoji text not null default '•',
  type public.tx_type not null,
  monthly_budget bigint check (monthly_budget > 0),
  sort smallint not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, type, name),
  unique (user_id, key)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  type public.tx_type not null,
  amount bigint not null check (amount > 0),
  description text not null default '',
  merchant text,
  category_id uuid references public.categories on delete set null,
  account_id uuid references public.accounts on delete set null,
  occurred_on date not null default (now() at time zone 'America/Bogota')::date,
  source public.tx_source not null default 'manual',
  status public.tx_status not null default 'confirmed',
  -- Id del correo, CUFE de la factura, etc. Evita importar dos veces lo mismo.
  external_id text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index transactions_user_day_idx
  on public.transactions (user_id, occurred_on desc, created_at desc);
create index transactions_category_idx on public.transactions (category_id);
create index transactions_account_idx on public.transactions (account_id);

-- Palabra clave (texto plegado: minúsculas y sin tildes) → categoría.
-- Se crean cuando el usuario corrige la categoría de un movimiento.
create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  keyword text not null,
  category_id uuid not null references public.categories on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, keyword)
);

create index category_rules_category_idx on public.category_rules (category_id);

-- updated_at automático
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger transactions_touch before update on public.transactions
  for each row execute function public.touch_updated_at();

-- RLS: cada usuario solo ve y modifica lo suyo.
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.category_rules enable row level security;

create policy "own accounts" on public.accounts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own categories" on public.categories for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own transactions" on public.transactions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rules" on public.category_rules for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Categorías y cuenta por defecto para cada usuario nuevo.
create function public.seed_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Basadas en las categorías que Jacobo ya usaba en su dashboard de Notion.
  insert into public.categories (user_id, key, name, emoji, type, sort) values
    (new.id, 'comida',          'Comida',          '🍔', 'expense', 1),
    (new.id, 'transporte',      'Transporte',      '🚕', 'expense', 2),
    (new.id, 'tienda',          'Tienda',          '🛒', 'expense', 3),
    (new.id, 'universidad',     'Universidad',     '🎓', 'expense', 4),
    (new.id, 'salud',           'Salud',           '💊', 'expense', 5),
    (new.id, 'entretenimiento', 'Entretenimiento', '🎉', 'expense', 6),
    (new.id, 'suscripciones',   'Suscripciones',   '📺', 'expense', 7),
    (new.id, 'compras',         'Compras',         '🛍️', 'expense', 8),
    (new.id, 'servicios',       'Servicios',       '💡', 'expense', 9),
    (new.id, 'vivienda',        'Vivienda',        '🏠', 'expense', 10),
    (new.id, 'otros_gasto',     'Varios',          '📦', 'expense', 99),
    (new.id, 'cuota_semanal',   'Cuota semanal',   '🗓️', 'income', 1),
    (new.id, 'regalos',         'Regalos',         '🎁', 'income', 2),
    (new.id, 'salario',         'Salario',         '💼', 'income', 3),
    (new.id, 'otros_ingreso',   'Otros',           '💰', 'income', 99);

  insert into public.accounts (user_id, name, kind) values (new.id, 'Efectivo', 'cash');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.seed_new_user();
