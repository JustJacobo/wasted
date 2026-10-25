-- Color de categoría para el dashboard. Debe coincidir con CATEGORY_COLORS en
-- src/lib/category-colors.ts. Null = gris neutro ("Varios" y "Otros").
alter table public.categories
  add column color text
  check (color in ('azul', 'naranja', 'aqua', 'amarillo', 'magenta', 'verde', 'violeta', 'rojo'));

-- Lo existente: en el orden de cada tipo, recorriendo la paleta; las de respaldo quedan en gris.
update public.categories c set color = (array[
  'azul', 'naranja', 'aqua', 'amarillo', 'magenta', 'verde', 'violeta', 'rojo'
])[((o.n - 1) % 8) + 1]
from (
  select id, row_number() over (partition by user_id, type order by archived, sort, name) as n
  from public.categories
  where key is distinct from 'otros_gasto' and key is distinct from 'otros_ingreso'
) o
where c.id = o.id;

create or replace function public.seed_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Basadas en las categorías que Jacobo ya usaba en su dashboard de Notion.
  insert into public.categories (user_id, key, name, emoji, icon, color, type, sort) values
    (new.id, 'comida',          'Comida',          '🍔', 'fork-knife',     'azul',     'expense', 1),
    (new.id, 'transporte',      'Transporte',      '🚕', 'taxi',           'naranja',  'expense', 2),
    (new.id, 'tienda',          'Tienda',          '🛒', 'shopping-cart',  'aqua',     'expense', 3),
    (new.id, 'universidad',     'Universidad',     '🎓', 'graduation-cap', 'amarillo', 'expense', 4),
    (new.id, 'salud',           'Salud',           '💊', 'pill',           'magenta',  'expense', 5),
    (new.id, 'entretenimiento', 'Entretenimiento', '🎉', 'confetti',       'verde',    'expense', 6),
    (new.id, 'suscripciones',   'Suscripciones',   '📺', 'television',     'violeta',  'expense', 7),
    (new.id, 'compras',         'Compras',         '🛍️', 'shopping-bag',   'rojo',     'expense', 8),
    (new.id, 'servicios',       'Servicios',       '💡', 'lightbulb',      'azul',     'expense', 9),
    (new.id, 'vivienda',        'Vivienda',        '🏠', 'house',          'naranja',  'expense', 10),
    (new.id, 'otros_gasto',     'Varios',          '📦', 'package',        null,       'expense', 99),
    (new.id, 'cuota_semanal',   'Cuota semanal',   '🗓️', 'calendar-check', 'azul',     'income', 1),
    (new.id, 'regalos',         'Regalos',         '🎁', 'gift',           'naranja',  'income', 2),
    (new.id, 'salario',         'Salario',         '💼', 'briefcase',      'aqua',     'income', 3),
    (new.id, 'otros_ingreso',   'Otros',           '💰', 'coins',          null,       'income', 99);

  insert into public.accounts (user_id, name, kind) values (new.id, 'Efectivo', 'cash');
  return new;
end;
$$;
