-- Allotment tracking: after an IPO's allotment is announced, any pool
-- member can mark each PAN's application as alloted / not alloted. Scope
-- (which PANs are visible for a given IPO) comes for free from the existing
-- is_pool_member() SELECT policy below — no separate filtering needed.

alter table public.pool_applications
  add column if not exists allotment_status text not null default 'pending'
    check (allotment_status in ('pending', 'alloted', 'not_alloted'));

create policy "pool members can update applications in their pools"
  on public.pool_applications for update
  using (public.is_pool_member(pool_id))
  with check (public.is_pool_member(pool_id));
