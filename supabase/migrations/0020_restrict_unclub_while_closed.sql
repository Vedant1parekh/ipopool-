-- Members shouldn't be able to bail out of a clubbed application while its
-- IPO is closed (allotment pending) — that's exactly when everyone's
-- counting on the group staying put. Leaving is fine before that (open/
-- upcoming) and after (listed, once things are settled).
drop policy if exists "members can remove their own clubbing" on public.pool_application_members;

create policy "members can remove their own clubbing except while closed"
  on public.pool_application_members for delete
  using (
    auth.uid() = profile_id
    and exists (
      select 1
      from public.pool_applications pa
      join public.pools p on p.id = pa.pool_id
      join public.ipos i on i.id = p.ipo_id
      where pa.id = application_id and i.status <> 'closed'
    )
  );
