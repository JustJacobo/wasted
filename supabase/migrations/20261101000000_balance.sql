-- Ingresos y gastos confirmados antes de una fecha: el saldo con que arranca la
-- semana. Con la sesión, RLS ya limita al usuario; el cliente de servicio pasa
-- p_user.
create function public.totals_before(p_before date, p_user uuid default null)
returns table (income bigint, expense bigint)
language sql stable security invoker set search_path = '' as $$
  select
    coalesce(sum(amount) filter (where type = 'income'), 0)::bigint,
    coalesce(sum(amount) filter (where type = 'expense'), 0)::bigint
  from public.transactions
  where status = 'confirmed'
    and occurred_on < p_before
    and (p_user is null or user_id = p_user);
$$;

revoke execute on function public.totals_before(date, uuid) from public, anon;
grant execute on function public.totals_before(date, uuid) to authenticated, service_role;
