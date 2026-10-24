-- Íconos propios de categoría (claves de src/lib/category-icons.ts). El emoji
-- se mantiene para Telegram y el correo. Null = categoría propia antigua (se muestra el emoji).
alter table public.categories add column icon text;

update public.categories c set icon = d.icon
from (values
  ('comida', 'fork-knife'), ('transporte', 'taxi'), ('tienda', 'shopping-cart'),
  ('universidad', 'graduation-cap'), ('salud', 'pill'), ('entretenimiento', 'confetti'),
  ('suscripciones', 'television'), ('compras', 'shopping-bag'), ('servicios', 'lightbulb'),
  ('vivienda', 'house'), ('otros_gasto', 'package'), ('cuota_semanal', 'calendar-check'),
  ('regalos', 'gift'), ('salario', 'briefcase'), ('otros_ingreso', 'coins')
) as d(key, icon)
where c.key = d.key;

create or replace function public.seed_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Basadas en las categorías que Jacobo ya usaba en su dashboard de Notion.
  insert into public.categories (user_id, key, name, emoji, icon, type, sort) values
    (new.id, 'comida',          'Comida',          '🍔', 'fork-knife',     'expense', 1),
    (new.id, 'transporte',      'Transporte',      '🚕', 'taxi',           'expense', 2),
    (new.id, 'tienda',          'Tienda',          '🛒', 'shopping-cart',  'expense', 3),
    (new.id, 'universidad',     'Universidad',     '🎓', 'graduation-cap', 'expense', 4),
    (new.id, 'salud',           'Salud',           '💊', 'pill',           'expense', 5),
    (new.id, 'entretenimiento', 'Entretenimiento', '🎉', 'confetti',       'expense', 6),
    (new.id, 'suscripciones',   'Suscripciones',   '📺', 'television',     'expense', 7),
    (new.id, 'compras',         'Compras',         '🛍️', 'shopping-bag',   'expense', 8),
    (new.id, 'servicios',       'Servicios',       '💡', 'lightbulb',      'expense', 9),
    (new.id, 'vivienda',        'Vivienda',        '🏠', 'house',          'expense', 10),
    (new.id, 'otros_gasto',     'Varios',          '📦', 'package',        'expense', 99),
    (new.id, 'cuota_semanal',   'Cuota semanal',   '🗓️', 'calendar-check', 'income', 1),
    (new.id, 'regalos',         'Regalos',         '🎁', 'gift',           'income', 2),
    (new.id, 'salario',         'Salario',         '💼', 'briefcase',      'income', 3),
    (new.id, 'otros_ingreso',   'Otros',           '💰', 'coins',          'income', 99);

  insert into public.accounts (user_id, name, kind) values (new.id, 'Efectivo', 'cash');
  return new;
end;
$$;
