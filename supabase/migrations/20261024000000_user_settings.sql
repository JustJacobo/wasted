-- Preferencias por usuario. Sin fila = valores por defecto (todo activado).
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  report_weekly boolean not null default true,
  report_monthly boolean not null default true,
  -- Para limitar el botón "Enviarme este reporte" a 1 envío por minuto.
  last_manual_report_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "own settings" on public.user_settings for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));
