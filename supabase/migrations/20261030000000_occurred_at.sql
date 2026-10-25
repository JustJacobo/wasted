-- Hora del movimiento. Es null cuando no se sabe (p. ej. "ayer" desde el modo
-- texto o una factura con otra fecha). occurred_on sigue mandando para agrupar
-- y sumar por día.
alter table public.transactions add column occurred_at timestamptz;

-- Lo registrado a mano o por Telegram el mismo día: la hora en que se guardó.
update public.transactions
set occurred_at = created_at
where source in ('manual', 'telegram')
  and (created_at at time zone 'America/Bogota')::date = occurred_on;

-- Lo del correo: la hora en que llegó la notificación, si es del mismo día.
update public.transactions t
set occurred_at = m.received_at
from public.mail_messages m
where m.transaction_id = t.id
  and (m.received_at at time zone 'America/Bogota')::date = t.occurred_on;

drop index public.transactions_user_day_idx;
create index transactions_user_day_idx
  on public.transactions (user_id, occurred_on desc, occurred_at desc nulls last, created_at desc);
