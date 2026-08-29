-- Adds email to profiles (readable, never a secret) — password stays
-- exclusively in Supabase's protected auth.users table.

alter table public.profiles add column if not exists email text;

-- Backfill existing rows (safe to run even if profiles is empty).
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- Keep new signups populated going forward.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;
