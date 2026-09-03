-- unclubFromApplication only ever deleted the caller's own club-in row, so
-- the reciprocal row automatically created by club_in_with_reciprocal
-- (0024) was left behind whenever either side left — the same asymmetry
-- problem the reciprocal club-in itself was built to avoid. Mirrors that
-- function's approach: SECURITY DEFINER, since removing the OTHER party's
-- row needs to bypass "auth.uid() = profile_id", and it re-derives the
-- pairing itself rather than trusting caller input for the reciprocal
-- side.
--
-- Replaces the RLS-policy-based delete (0020) for this path; that policy
-- stays in place as a fallback for any direct delete, but this function is
-- now what the app actually calls.

create function public.unclub_with_reciprocal(p_application_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_pool_id uuid;
  v_pan_card_id uuid;
  v_target_owner uuid;
  v_target_pan_card_id uuid;
  v_source_application_id uuid;
begin
  select pool_id into v_pool_id from public.pool_applications where id = p_application_id;

  if v_pool_id is null then
    raise exception 'Application not found.';
  end if;

  if exists (
    select 1
    from public.pools p
    join public.ipos i on i.id = p.ipo_id
    where p.id = v_pool_id and i.status = 'closed'
  ) then
    raise exception 'Cannot leave while the IPO is closed and awaiting allotment.';
  end if;

  select pan_card_id into v_pan_card_id
  from public.pool_application_members
  where application_id = p_application_id and profile_id = v_caller;

  delete from public.pool_application_members
  where application_id = p_application_id and profile_id = v_caller;

  if v_pan_card_id is null then
    -- Legacy row from before pan_card_id existed — nothing to pair back to.
    return;
  end if;

  select pc.owner_id, pa.pan_card_id
    into v_target_owner, v_target_pan_card_id
  from public.pool_applications pa
  join public.pan_cards pc on pc.id = pa.pan_card_id
  where pa.id = p_application_id;

  if v_target_owner is null then
    return;
  end if;

  select id into v_source_application_id
  from public.pool_applications
  where pool_id = v_pool_id and pan_card_id = v_pan_card_id;

  if v_source_application_id is not null then
    delete from public.pool_application_members
    where application_id = v_source_application_id
      and profile_id = v_target_owner
      and pan_card_id = v_target_pan_card_id;
  end if;
end;
$$;

grant execute on function public.unclub_with_reciprocal(uuid) to authenticated;
