-- joinPool() looked up `pools` by invite_code with a plain SELECT, but the
-- RLS policy only allows members/owners to see a pool row — so someone who
-- isn't a member yet (i.e. everyone trying to join) always got 0 rows back,
-- even with a correct code. A SECURITY DEFINER function does the lookup and
-- the membership insert atomically, without needing to open up a broad
-- SELECT policy on `pools` (which would expose every invite code to any
-- authenticated user).

create or replace function public.join_pool_by_invite_code(code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  target_pool_id uuid;
begin
  if not exists (select 1 from public.pan_cards where owner_id = auth.uid()) then
    raise exception 'Add at least one PAN card before joining a pool.';
  end if;

  select id into target_pool_id from public.pools where invite_code = code;

  if target_pool_id is null then
    raise exception 'No pool found for that invite code.';
  end if;

  insert into public.pool_members (pool_id, profile_id)
  values (target_pool_id, auth.uid())
  on conflict (pool_id, profile_id) do nothing;

  return target_pool_id;
end;
$$;

grant execute on function public.join_pool_by_invite_code(text) to authenticated;
