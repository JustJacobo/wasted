-- Acceso por invitación: solo los correos en `members` pueden usar Wasted.
-- Los dueños (role = 'owner') invitan y quitan personas desde Ajustes.

create table public.members (
  email text primary key check (email = lower(email)),
  role text not null default 'member' check (role in ('owner', 'member')),
  invited_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create function public.current_email() returns text
language sql stable as $$
  select lower(auth.jwt() ->> 'email')
$$;

-- security definer para que las políticas de `members` puedan consultarla sin recursión.
create function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where email = public.current_email())
$$;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members where email = public.current_email() and role = 'owner'
  )
$$;

alter table public.members enable row level security;

create policy "members read" on public.members for select to authenticated
  using (email = public.current_email() or (select public.is_owner()));
create policy "owners invite" on public.members for insert to authenticated
  with check ((select public.is_owner()) and role = 'member');
create policy "owners remove" on public.members for delete to authenticated
  using ((select public.is_owner()) and role = 'member');

-- Los datos solo son accesibles para miembros (además de ser del propio usuario).
alter policy "own accounts" on public.accounts
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));
alter policy "own categories" on public.categories
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));
alter policy "own transactions" on public.transactions
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));
alter policy "own rules" on public.category_rules
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));

-- Dueño inicial.
insert into public.members (email, role) values ('jacobogiraldorios@gmail.com', 'owner');
