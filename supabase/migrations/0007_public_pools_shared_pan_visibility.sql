-- 1. Pools become browsable by any signed-in user (not just members) so
--    people can discover and join an existing pool for a given IPO/category.
drop policy if exists "pool members or the owner can view their pools" on public.pools;

create policy "any signed-in user can view all pools"
  on public.pools for select
  using (auth.role() = 'authenticated');

-- 2. PAN numbers become visible to anyone who shares a pool with the owner
--    (so pool-mates can verify each other's PAN once joined), but adding,
--    editing, or removing a PAN card is still owner-only.
create function public.shares_pool_with(other_user_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1
    from public.pool_members pm1
    join public.pool_members pm2 on pm1.pool_id = pm2.pool_id
    where pm1.profile_id = auth.uid() and pm2.profile_id = other_user_id
  );
$$;

drop policy if exists "users manage only their own PAN cards" on public.pan_cards;

create policy "owners and pool-mates can view a PAN card"
  on public.pan_cards for select
  using (auth.uid() = owner_id or public.shares_pool_with(owner_id));

create policy "only the owner can add a PAN card"
  on public.pan_cards for insert
  with check (auth.uid() = owner_id);

create policy "only the owner can edit their PAN card"
  on public.pan_cards for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "only the owner can remove their PAN card"
  on public.pan_cards for delete
  using (auth.uid() = owner_id);
