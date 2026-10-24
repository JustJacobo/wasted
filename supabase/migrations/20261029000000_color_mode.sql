-- Modo claro u oscuro elegido en Ajustes. Debe coincidir con COLOR_MODES en src/lib/theme.ts.
alter table public.user_settings
  add column color_mode text not null default 'system'
  check (color_mode in ('system', 'light', 'dark'));
