-- Recurrentes + correo: cómo aparece el cobro en el correo ("google play"),
-- aprendido al confirmarlo. Sirve para reconocerlo aunque cambie el precio.

alter table public.recurring add column match_hint text;
