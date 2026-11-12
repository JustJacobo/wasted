-- Datos de peor caso para probar pantallas (skill break-ui). Solo para la base LOCAL.
--
-- Uso (con `npx supabase start` corriendo):
--   1. Invitar y crear la cuenta:
--        insert into members (email, role) values ('peor@wasted.local', 'member');
--      y crear el usuario en Studio (Authentication → Add user) o entrando con el enlace mágico.
--   2. docker cp supabase/dev/peor-caso.sql supabase_db_Wasted:/tmp/ &&
--      docker exec supabase_db_Wasted psql -U postgres -f /tmp/peor-caso.sql
--   3. Entrar en la app con peor@wasted.local (Mailpit: http://127.0.0.1:54324).
--
-- Se puede correr varias veces: borra y vuelve a crear lo de esa cuenta.
do $$
declare
  u uuid := (select id from auth.users where email = 'peor@wasted.local');
  c_comida uuid; c_trans uuid; c_viv uuid; c_susc uuid; c_cuota uuid; c_larga uuid;
  t_dup uuid;
  l1 uuid; l2 uuid; g1 uuid; g2 uuid;
  today date := (now() at time zone 'America/Bogota')::date;
  monday date := date_trunc('week', (now() at time zone 'America/Bogota'))::date;
  i int;
begin
  delete from balance_moves where user_id = u;
  delete from loans where user_id = u;
  delete from goals where user_id = u;
  delete from transactions where user_id = u;
  delete from recurring where user_id = u;
  delete from categories where user_id = u and key is null;

  select id into c_comida from categories where user_id = u and key = 'comida';
  select id into c_trans from categories where user_id = u and key = 'transporte';
  select id into c_viv from categories where user_id = u and key = 'vivienda';
  select id into c_susc from categories where user_id = u and key = 'suscripciones';
  select id into c_cuota from categories where user_id = u and key = 'cuota_semanal';
  -- Nombre de categoría al límite de 30 del formulario.
  update categories set name = 'Suscripciones y plataformas' where id = c_susc;
  insert into categories (user_id, name, type, icon, color, sort)
    values (u, 'Regalos de cumpleaños familia', 'expense', 'gift', 'magenta', 20) returning id into c_larga;

  -- Esta semana: ingreso grande, gasto enorme (saldo muy negativo), textos largos.
  insert into transactions (user_id, type, amount, description, category_id, occurred_on, occurred_at) values
    (u, 'income', 2450000, 'Cuota semanal', c_cuota, monday, monday + time '08:00'),
    (u, 'expense', 1250000000, 'Cuota inicial apartamento', c_viv, today, now()),
    (u, 'expense', 487300, 'Almuerzo con el equipo de trabajo en el restaurante del centro comercial Santafé, incluye postres, bebidas y la propina voluntaria que pidieron al final porque éramos un grupo grande de doce personas', c_comida, today, now() - interval '1 hour'),
    (u, 'expense', 3500, 'Té', c_comida, today, now() - interval '2 hours'),
    (u, 'expense', 38900, '🍕 Pizza con los parceros 🎉🎉', c_comida, today - 1, now() - interval '1 day'),
    (u, 'expense', 7901, '', c_trans, today - 1, now() - interval '26 hours'),
    (u, 'expense', 129900, 'Regalo para la tía Rosalba', c_larga, today - 2, null),
    (u, 'expense', 26900, 'Netflix Premium 4 pantallas', c_susc, today - 2, null);
  insert into transactions (user_id, type, amount, description, merchant, category_id, occurred_on, source, occurred_at)
    values (u, 'expense', 18450, 'UBER *TRIP HELP.UBER.COM 8005928996 BOGOTA DC COL', 'UBER *TRIP HELP.UBER.COM', c_trans, today - 1, 'notification', now() - interval '30 hours')
    returning id into t_dup;
  insert into transactions (user_id, type, amount, description, merchant, category_id, occurred_on, source, occurred_at)
    values (u, 'expense', 23800, 'Rappi · Restaurante Sin Miseria - Metro Avenida Chile Calle 72', 'Rappi', c_comida, today - 3, 'email_other', null);

  -- 120 movimientos más en el mes, para la lista larga.
  for i in 1..120 loop
    insert into transactions (user_id, type, amount, description, category_id, occurred_on)
    values (u, 'expense', 5000 + (i * 1373) % 90000,
            (array['Almuerzo','DiDi a la universidad','Tienda D1','Café','Yango casa','Fotocopias'])[1 + i % 6],
            (array[c_comida, c_trans, c_comida, c_comida, c_trans, c_larga])[1 + i % 6],
            greatest(date_trunc('month', today)::date, today - 4 - (i % 9)));
  end loop;

  -- Bandeja: comercio larguísimo, posible repetido y monto enorme.
  insert into transactions (user_id, type, amount, description, merchant, category_id, occurred_on, source, status, raw) values
    (u, 'expense', 18450, '', 'Uber', c_trans, today - 1, 'email_other', 'pending', jsonb_build_object('provider', 'uber', 'possibleDuplicateOf', t_dup)),
    (u, 'expense', 1834500, '', 'ALMACENES ÉXITO S.A. SUCURSAL CENTRO COMERCIAL SANTAFÉ BOGOTÁ NIT 890900608-9', null, today, 'email_invoice', 'pending', '{"provider":"dian"}'),
    (u, 'income', 999999999999, 'Transferencia recibida', 'Bartholomew Fitzgerald-Montgomery Villalobos', null, today, 'notification', 'pending', '{"provider":"nequi"}');

  -- Recurrentes: 5 en los próximos 7 días (se ven 3 + "y 2 más").
  insert into recurring (user_id, type, amount, description, category_id, every, unit, starts_on, next_on) values
    (u, 'expense', 2800000, 'Arriendo apartamento Chapinero Alto con parqueadero', c_viv, 1, 'month', today + 1, today + 1),
    (u, 'expense', 26900, 'Netflix Premium 4 pantallas', c_susc, 1, 'month', today + 2, today + 2),
    (u, 'income', 2450000, 'Cuota semanal', c_cuota, 1, 'week', monday + 7, monday + 7),
    (u, 'expense', 9900, 'iCloud+', c_susc, 1, 'month', today + 3, today + 3),
    (u, 'expense', 15000, 'Spotify', c_susc, 1, 'month', today + 4, today + 4);

  -- Préstamos y metas al límite de 60 caracteres.
  insert into loans (user_id, person, direction) values (u, 'María Fernanda Rodríguez de la Torre Villalobos Castañeda', 'lent') returning id into l1;
  insert into loans (user_id, person, direction) values (u, 'Jo', 'borrowed') returning id into l2;
  insert into balance_moves (user_id, amount, loan_id, occurred_on) values (u, -35000000, l1, today - 2), (u, 4000000, l1, today), (u, 15000, l2, today - 1);
  insert into goals (user_id, name, target) values (u, 'Viaje a Japón con la familia en diciembre del próximo año', 45000000) returning id into g1;
  insert into goals (user_id, name, target) values (u, 'Portátil', 1) returning id into g2;
  insert into balance_moves (user_id, amount, goal_id, occurred_on) values (u, -12345678, g1, today - 3), (u, -250000, g2, today);
end $$;
