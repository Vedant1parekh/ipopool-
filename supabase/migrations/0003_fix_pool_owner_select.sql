-- createPool() does `insert(...).select().single()` on `pools` to get the
-- new pool's id back. At that instant the owner isn't a pool_member yet
-- (that row is inserted right after), so the old SELECT policy hid the
-- row from the INSERT ... RETURNING, and Postgres raised "new row violates
-- row-level security policy for table \"pools\"" instead of returning it.
-- Letting the owner see their own pool immediately fixes this.

drop policy if exists "pool members can view their pools" on public.pools;

create policy "pool members or the owner can view their pools"
  on public.pools for select
  using (public.is_pool_member(id) or owner_id = auth.uid());
