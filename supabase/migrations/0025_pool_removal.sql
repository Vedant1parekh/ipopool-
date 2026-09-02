-- Pools had no delete policy at all — no one could remove one. Any member
-- of the pool can now remove it, but only starting one day after the IPO's
-- listing date (before that, members are still relying on it). Cascades
-- clean up pool_members, pool_applications, and pool_application_members
-- automatically (all already on delete cascade from 0001/0008).

create policy "any member can remove a pool one day after its IPO lists"
  on public.pools for delete
  using (
    public.is_pool_member(id)
    and exists (
      select 1 from public.ipos i
      where i.id = pools.ipo_id
        and i.listing_date is not null
        and current_date >= i.listing_date + 1
    )
  );
