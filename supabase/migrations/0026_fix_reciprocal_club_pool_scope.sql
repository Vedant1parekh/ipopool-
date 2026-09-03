-- Bug fix: club_in_with_reciprocal (0024) checked whether the caller had
-- already used this PAN card against the target owner across EVERY pool,
-- not just the current one - the pool_id filter present in the original
-- plain-TypeScript version of this check was dropped when it moved into
-- this SQL function. That contradicts the documented design: a card
-- should get a fresh allowance against the same owner in a different
-- pool, only reuse within the SAME pool should be blocked. Same bug
-- existed in the reciprocal side's own cap check.

create or replace function public.club_in_with_reciprocal(p_application_id uuid, p_pan_card_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_pool_id uuid;
  v_target_owner uuid;
  v_target_pan_card_id uuid;
  v_source_application_id uuid;
begin
  if not exists (select 1 from public.pan_cards where id = p_pan_card_id and owner_id = v_caller) then
    raise exception 'You can only club in with your own PAN cards.';
  end if;

  select pool_id into v_pool_id from public.pool_applications where id = p_application_id;

  if v_pool_id is null or not public.is_pool_member(v_pool_id) then
    raise exception 'Application not found.';
  end if;

  if not exists (
    select 1 from public.pool_applications
    where pool_id = v_pool_id and pan_card_id = p_pan_card_id and status = 'applied'
  ) then
    raise exception 'You can only club in with a PAN card that has actually applied in this pool.';
  end if;

  select pc.owner_id, pa.pan_card_id
    into v_target_owner, v_target_pan_card_id
  from public.pool_applications pa
  join public.pan_cards pc on pc.id = pa.pan_card_id
  where pa.id = p_application_id and pa.status = 'applied' and pa.allotment_status = 'pending';

  if v_target_owner is null then
    raise exception 'You can only club onto an application thats actually been applied.';
  end if;

  if v_target_owner = v_caller then
    raise exception 'You cannot club onto your own application.';
  end if;

  if exists (
    select 1
    from public.pool_application_members pam
    join public.pool_applications pa on pa.id = pam.application_id
    join public.pan_cards pc on pc.id = pa.pan_card_id
    where pam.profile_id = v_caller
      and pam.pan_card_id = p_pan_card_id
      and pc.owner_id = v_target_owner
      and pa.pool_id = v_pool_id
  ) then
    raise exception 'You have already used this PAN card to club onto one of this members applications.';
  end if;

  insert into public.pool_application_members (application_id, profile_id, pan_card_id)
  values (p_application_id, v_caller, p_pan_card_id);

  -- Reciprocal side: the target owner's own applied PAN for THIS
  -- application gets clubbed onto the caller's own application that uses
  -- the PAN the caller just clubbed in with - skipped quietly (not an
  -- error) if the caller has no such application, or the target owner has
  -- already used that card against the caller IN THIS POOL, or already hit
  -- their own per-owner cap.
  select id into v_source_application_id
  from public.pool_applications
  where pool_id = v_pool_id and pan_card_id = p_pan_card_id and status = 'applied';

  if v_source_application_id is not null
     and not exists (
       select 1
       from public.pool_application_members pam
       join public.pool_applications pa on pa.id = pam.application_id
       join public.pan_cards pc on pc.id = pa.pan_card_id
       where pam.profile_id = v_target_owner
         and pam.pan_card_id = v_target_pan_card_id
         and pc.owner_id = v_caller
         and pa.pool_id = v_pool_id
     )
  then
    insert into public.pool_application_members (application_id, profile_id, pan_card_id)
    values (v_source_application_id, v_target_owner, v_target_pan_card_id)
    on conflict (application_id, profile_id) do nothing;
  end if;
end;
$$;
