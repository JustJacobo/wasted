-- Tema de acento elegido en Ajustes. Debe coincidir con ACCENTS en src/lib/theme.ts.
alter table public.user_settings
  add column accent text not null default 'tinta'
  check (accent in ('tinta', 'brasa', 'cobalto', 'lila', 'menta'));
