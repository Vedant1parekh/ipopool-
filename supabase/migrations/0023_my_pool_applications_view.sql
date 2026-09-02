-- The allotments page previously relied on an app-level filter to only
-- show applications the viewer is personally part of (as applicant or
-- clubbed-in member), but the underlying "pool members can view
-- applications in their pools" RLS policy (0001) is intentionally broad
-- -- clubbing depends on seeing every pending application in a shared
-- pool, so that policy can't be narrowed without breaking it there.
--
-- This view exists only for the allotments use case: it exposes exactly
-- the rows where the caller is the applicant or a club member, checked in
-- the view itself, so a direct query against it can't see more than that
-- regardless of what the underlying table's RLS otherwise allows.

create view public.my_pool_applications
with (security_invoker = true) as
select pa.*
from public.pool_applications pa
where
  exists (
    select 1 from public.pan_cards pc
    where pc.id = pa.pan_card_id and pc.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.pool_application_members pam
    where pam.application_id = pa.id and pam.profile_id = auth.uid()
  );

grant select on public.my_pool_applications to authenticated;
