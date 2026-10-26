-- Atajos y widgets (Atajos de iPhone, Scriptable, HTTP Shortcuts en Android):
-- llaman a /api/atajos/* con una clave personal. Se guarda solo su hash.

alter type public.tx_source add value 'shortcut';

create table public.api_tokens (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.api_tokens enable row level security;

-- La API la lee con el cliente de servicio; el usuario solo crea, ve y revoca la suya.
create policy "own api token" on public.api_tokens for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));
