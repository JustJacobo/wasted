-- Solo para la base local (npx supabase db reset): un dueño de prueba
-- para entrar con enlace mágico vía Mailpit.
insert into public.members (email, role) values ('dev@wasted.local', 'owner')
on conflict (email) do nothing;
